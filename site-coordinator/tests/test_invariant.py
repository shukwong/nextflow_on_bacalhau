"""Unit tests for the privacy-invariant checker."""

from __future__ import annotations

from pathlib import Path

import pytest

from site_coordinator.invariant import (
    EXPECTED_COL_COUNT,
    EXPECTED_COLUMNS,
    check_counts_file,
    digest_file,
)


pytestmark = pytest.mark.unit


def test_good_counts_passes(fixtures_dir: Path) -> None:
    result = check_counts_file(fixtures_dir / "good_counts.tsv")
    assert result.ok, result.model_dump()
    names = {c.name for c in result.checks}
    # file_exists is only emitted when the file is missing (short-circuit)
    assert {
        "size_bound",
        "counts_columns",
        "counts_header_names",
        "no_sample_ids",
        "rows_column_count",
    } <= names


def test_leaky_counts_fails_with_sample_column(fixtures_dir: Path) -> None:
    result = check_counts_file(fixtures_dir / "bad_counts.tsv")
    assert not result.ok
    failed = [c for c in result.checks if not c.passed]
    assert any(c.name == "no_sample_ids" for c in failed)


def test_missing_file_short_circuits(tmp_path: Path) -> None:
    result = check_counts_file(tmp_path / "nope.tsv")
    assert not result.ok
    assert any(c.name == "file_exists" and not c.passed for c in result.checks)


def test_wrong_column_count_fails(tmp_path: Path) -> None:
    path = tmp_path / "counts.tsv"
    path.write_text("CHROM\tPOS\tREF\tALT\tAC\n" "chr1\t1\tA\tG\t1\n", encoding="utf-8")
    result = check_counts_file(path)
    assert not result.ok
    assert any(c.name == "counts_columns" and not c.passed for c in result.checks)


def test_digest_matches_known_content(tmp_path: Path) -> None:
    path = tmp_path / "blob.txt"
    path.write_bytes(b"hello")
    # sha256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    assert digest_file(path) == (
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    )


def test_expected_schema_is_six_columns() -> None:
    assert EXPECTED_COL_COUNT == 6
    assert EXPECTED_COLUMNS == ("CHROM", "POS", "REF", "ALT", "AC", "AN")


def test_invariant_catches_leaky_row_beyond_2000(tmp_path: Path) -> None:
    """Row-scan must not cap at 2000 rows — a leaky row later must still fail."""

    path = tmp_path / "big_counts.tsv"
    lines = ["CHROM\tPOS\tREF\tALT\tAC\tAN"]
    for i in range(2499):
        lines.append(f"chr1\t{1000 + i}\tA\tG\t1\t120")
    # Row 2500 has 7 cells — the canary for the row-scan-cap bug.
    lines.append("chr1\t99999\tA\tG\t1\t120\tHG00099_LEAK")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    result = check_counts_file(path)
    assert not result.ok, result.model_dump()
    failed = [c.name for c in result.checks if not c.passed]
    assert "rows_column_count" in failed

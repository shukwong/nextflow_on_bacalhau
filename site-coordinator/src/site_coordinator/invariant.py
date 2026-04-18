"""Privacy-invariant checker.

The coordinator refuses to publish a per-site counts.tsv unless every check
below passes. The checks mirror what the federated-AF demo's run.sh does
at the edge, re-implemented here so the aggregator can't pull leaky data.

Schema contract (per-site counts, design §2):
    CHROM  POS  REF  ALT  AC  AN     (6 columns, tab-delimited)
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

from .models import InvariantCheck, InvariantResult

EXPECTED_COLUMNS = ("CHROM", "POS", "REF", "ALT", "AC", "AN")
EXPECTED_COL_COUNT = len(EXPECTED_COLUMNS)

# Signatures for per-sample columns we must never see.
_SAMPLE_ID_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"^FORMAT$", re.IGNORECASE),
    re.compile(r"^GT$", re.IGNORECASE),
    re.compile(r"^GENOTYPE", re.IGNORECASE),
    re.compile(r"^SAMPLE", re.IGNORECASE),
    re.compile(r"^IND(IVIDUAL)?", re.IGNORECASE),
    re.compile(r"^HG\d+", re.IGNORECASE),
    re.compile(r"^NA\d+", re.IGNORECASE),
)

# Hard ceiling on per-site counts file size. A legitimate site counts file
# with ~10^7 variants is bounded by ~500 MB; 1 GiB is a generous upper bound.
MAX_FILE_BYTES = 1024 * 1024 * 1024


def _header_is_leaky(header_cells: list[str]) -> list[str]:
    leaked: list[str] = []
    for cell in header_cells:
        if any(pat.match(cell) for pat in _SAMPLE_ID_PATTERNS):
            leaked.append(cell)
    return leaked


def check_counts_file(path: Path) -> InvariantResult:
    """Run every invariant check on ``path`` and return a structured result."""

    checks: list[InvariantCheck] = []

    if not path.exists():
        checks.append(
            InvariantCheck(
                name="file_exists",
                expected="present",
                observed="missing",
                passed=False,
            )
        )
        return InvariantResult(ok=False, checks=tuple(checks))

    size = path.stat().st_size
    checks.append(
        InvariantCheck(
            name="size_bound",
            expected=f"<= {MAX_FILE_BYTES} bytes",
            observed=str(size),
            passed=size <= MAX_FILE_BYTES,
        )
    )

    with path.open("r", encoding="utf-8", errors="replace") as fh:
        header_line = fh.readline().rstrip("\n").lstrip("#").strip()
        header_cells = [c.strip() for c in header_line.split("\t") if c != ""]

        checks.append(
            InvariantCheck(
                name="counts_columns",
                expected=str(EXPECTED_COL_COUNT),
                observed=str(len(header_cells)),
                passed=len(header_cells) == EXPECTED_COL_COUNT,
            )
        )
        checks.append(
            InvariantCheck(
                name="counts_header_names",
                expected=",".join(EXPECTED_COLUMNS),
                observed=",".join(header_cells[:EXPECTED_COL_COUNT]),
                passed=tuple(c.upper() for c in header_cells[:EXPECTED_COL_COUNT])
                == EXPECTED_COLUMNS,
            )
        )

        leaks = _header_is_leaky(header_cells)
        checks.append(
            InvariantCheck(
                name="no_sample_ids",
                expected="no per-sample column names",
                observed=", ".join(leaks) if leaks else "none",
                passed=not leaks,
            )
        )

        # Scan every data row. MAX_FILE_BYTES already bounds the cost; capping
        # the row count would let a leaky row past the checker on a long file.
        bad_row: int | None = None
        for idx, line in enumerate(fh, start=2):
            if not line.strip():
                continue
            cells = line.rstrip("\n").split("\t")
            if len(cells) != EXPECTED_COL_COUNT:
                bad_row = idx
                break

        checks.append(
            InvariantCheck(
                name="rows_column_count",
                expected=f"{EXPECTED_COL_COUNT} per row",
                observed="ok" if bad_row is None else f"row {bad_row}",
                passed=bad_row is None,
            )
        )

    ok = all(c.passed for c in checks)
    return InvariantResult(ok=ok, checks=tuple(checks))


def digest_file(path: Path, *, chunk_size: int = 1 << 20) -> str:
    """Return the SHA-256 hex digest of ``path``."""

    h = hashlib.sha256()
    with path.open("rb") as fh:
        while True:
            chunk = fh.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()

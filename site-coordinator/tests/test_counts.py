"""Integration tests for /v1/counts/{run_id}."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from site_coordinator.launcher import FakeLauncher
from site_coordinator.main import create_app

from .conftest import _StubBacalhau, wait_for_state

pytestmark = pytest.mark.integration

_AUTH = {"Authorization": "Bearer test-token"}


def test_counts_served_after_success(client: TestClient) -> None:
    resp = client.post("/v1/runs", json={"shard_ref": "s1"}, headers=_AUTH)
    run_id = resp.json()["run_id"]
    wait_for_state(client, run_id, states=("succeeded",))

    counts_resp = client.get(f"/v1/counts/{run_id}")
    assert counts_resp.status_code == 200, counts_resp.text
    assert counts_resp.headers["content-type"].startswith("text/tab-separated-values")
    assert counts_resp.headers.get("x-counts-digest")

    body = counts_resp.text
    header = body.splitlines()[0]
    assert header.split("\t") == ["CHROM", "POS", "REF", "ALT", "AC", "AN"]


def test_counts_blocked_when_invariant_fails(leaky_client: TestClient) -> None:
    resp = leaky_client.post("/v1/runs", json={"shard_ref": "s1"}, headers=_AUTH)
    run_id = resp.json()["run_id"]
    wait_for_state(leaky_client, run_id, states=("failed",))

    counts_resp = leaky_client.get(f"/v1/counts/{run_id}")
    assert counts_resp.status_code == 409
    detail = counts_resp.json()["detail"]
    assert detail["reason"] in {"run is not in succeeded state", "privacy invariant failed"}


def test_counts_404_for_unknown_run(client: TestClient) -> None:
    resp = client.get("/v1/counts/fr-nope")
    assert resp.status_code == 404


def test_counts_fetch_is_audit_logged(client: TestClient, settings) -> None:
    resp = client.post("/v1/runs", json={"shard_ref": "s1"}, headers=_AUTH)
    run_id = resp.json()["run_id"]
    wait_for_state(client, run_id, states=("succeeded",))

    assert client.get(f"/v1/counts/{run_id}").status_code == 200

    audit_path = settings.workdir_root / "audit" / "counts.jsonl"
    assert audit_path.exists()
    lines = audit_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1
    import json as _json

    entry = _json.loads(lines[0])
    assert entry["event"] == "counts_fetch"
    assert entry["run_id"] == run_id
    assert entry["site_id"] == "test-site"
    assert entry["invariant_ok"] is True
    assert entry["digest"]


def test_counts_filename_override_is_respected(settings) -> None:
    """A non-default counts_filename must flow from Settings to the launcher
    and back to the served file, so the invariant checks the correct path."""

    overridden = settings.model_copy(update={"counts_filename": "per_site.tsv"})
    app = create_app(
        settings=overridden,
        launcher=FakeLauncher(rows=2, leaky=False),
        bacalhau=_StubBacalhau(alive=True),
    )
    with TestClient(app) as c:
        resp = c.post("/v1/runs", json={"shard_ref": "s1"}, headers=_AUTH)
        assert resp.status_code == 202, resp.text
        run_id = resp.json()["run_id"]
        wait_for_state(c, run_id, states=("succeeded", "failed"))

        counts_resp = c.get(f"/v1/counts/{run_id}")
        assert counts_resp.status_code == 200, counts_resp.text
        header = counts_resp.text.splitlines()[0]
        assert header.split("\t") == ["CHROM", "POS", "REF", "ALT", "AC", "AN"]

    # Launcher must have written to per_site.tsv, not counts.tsv.
    run_dir = overridden.workdir_root / "runs" / run_id
    assert (run_dir / "per_site.tsv").exists()
    assert not (run_dir / "counts.tsv").exists()

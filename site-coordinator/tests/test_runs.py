"""Integration tests for /v1/runs with FastAPI TestClient + FakeLauncher."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from .conftest import wait_for_state

pytestmark = pytest.mark.integration

_AUTH = {"Authorization": "Bearer test-token"}


def test_healthz_reports_site_and_version(client: TestClient) -> None:
    resp = client.get("/v1/healthz")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["ok"] is True
    assert payload["site_id"] == "test-site"
    assert payload["bacalhau_reachable"] is True
    assert payload["version"]


def test_post_run_without_token_is_denied(client: TestClient) -> None:
    resp = client.post("/v1/runs", json={"shard_ref": "s1"})
    assert resp.status_code == 401


def test_post_run_with_wrong_token_is_denied(client: TestClient) -> None:
    resp = client.post(
        "/v1/runs",
        json={"shard_ref": "s1"},
        headers={"Authorization": "Bearer nope"},
    )
    assert resp.status_code == 401


def test_post_run_rejects_unknown_fields(client: TestClient) -> None:
    resp = client.post(
        "/v1/runs",
        json={"shard_ref": "s1", "shard_path": "/etc/passwd"},  # forbidden
        headers=_AUTH,
    )
    assert resp.status_code == 422


def test_happy_path_run_reaches_succeeded(client: TestClient) -> None:
    resp = client.post(
        "/v1/runs",
        json={"shard_ref": "s1", "pipeline_ref": "main.nf"},
        headers=_AUTH,
    )
    assert resp.status_code == 202, resp.text
    acceptance = resp.json()
    run_id = acceptance["run_id"]
    assert run_id.startswith("fr-")
    assert acceptance["site_id"] == "test-site"

    final = wait_for_state(client, run_id, states=("succeeded", "failed"))
    assert final["state"] == "succeeded", final
    assert final["invariant"]["ok"] is True
    assert final["result_digest"]
    assert len(final["result_digest"]) == 64  # sha256 hex


def test_unknown_run_id_returns_404(client: TestClient) -> None:
    resp = client.get("/v1/runs/fr-nope")
    assert resp.status_code == 404


def test_leaky_run_marks_state_failed(leaky_client: TestClient) -> None:
    resp = leaky_client.post("/v1/runs", json={"shard_ref": "s1"}, headers=_AUTH)
    assert resp.status_code == 202
    run_id = resp.json()["run_id"]

    final = wait_for_state(leaky_client, run_id, states=("succeeded", "failed"))
    assert final["state"] == "failed", final
    assert final["invariant"]["ok"] is False
    failed_names = {c["name"] for c in final["invariant"]["checks"] if not c["passed"]}
    assert "no_sample_ids" in failed_names


def test_cancel_terminal_run_returns_409(client: TestClient) -> None:
    resp = client.post("/v1/runs", json={"shard_ref": "s1"}, headers=_AUTH)
    run_id = resp.json()["run_id"]
    wait_for_state(client, run_id, states=("succeeded", "failed"))

    cancel_resp = client.post(f"/v1/runs/{run_id}/cancel", headers=_AUTH)
    assert cancel_resp.status_code == 409

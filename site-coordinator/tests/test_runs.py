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


def test_cancel_with_lost_handle_returns_409(settings) -> None:
    """If the supervisor has no handle for a non-terminal run (e.g. after a
    coordinator restart), cancel must return 409 rather than silently claim
    success. The underlying subprocess is gone — there is nothing to kill."""

    import time as _time

    from fastapi.testclient import TestClient

    from site_coordinator.launcher import FakeLauncher, LaunchHandle, LaunchSpec
    from site_coordinator.main import create_app

    from .conftest import _StubBacalhau

    class _StuckLauncher(FakeLauncher):
        def launch(self, spec: LaunchSpec) -> LaunchHandle:
            h = super().launch(spec)
            # Keep returning None so the watcher never finalises.
            return h

        def poll(self, handle: LaunchHandle) -> int | None:
            return None

    app = create_app(
        settings=settings,
        launcher=_StuckLauncher(rows=2, leaky=False),
        bacalhau=_StubBacalhau(alive=True),
    )
    with TestClient(app) as c:
        resp = c.post("/v1/runs", json={"shard_ref": "s1"}, headers=_AUTH)
        assert resp.status_code == 202, resp.text
        run_id = resp.json()["run_id"]

        # Wait for the run to be in RUNNING before the handle disappears.
        deadline = _time.monotonic() + 2.0
        while _time.monotonic() < deadline:
            state = c.get(f"/v1/runs/{run_id}").json()["state"]
            if state == "running":
                break
            _time.sleep(0.05)

        # Simulate a lost handle (post-restart scenario) without going through
        # supervisor.cancel, which would also set state=cancelled.
        app.state.supervisor._handles.pop(run_id, None)

        cancel_resp = c.post(f"/v1/runs/{run_id}/cancel", headers=_AUTH)
        assert cancel_resp.status_code == 409, cancel_resp.text
        detail = cancel_resp.json()["detail"]
        assert "no live handle" in detail["reason"]


def test_startup_resets_stale_runs(settings) -> None:
    """A coordinator restart must flip non-terminal runs in the snapshot to
    failed; otherwise the dashboard shows ghost RUNNING runs forever and the
    cancel endpoint is the only way to clear them."""

    from datetime import datetime, timezone

    from fastapi.testclient import TestClient

    from site_coordinator.launcher import FakeLauncher
    from site_coordinator.main import create_app
    from site_coordinator.models import RunState, SiteRun
    from site_coordinator.store import RunStore

    from .conftest import _StubBacalhau

    snapshot = settings.workdir_root / "state" / "runs.json"
    pre = RunStore(snapshot_path=snapshot)
    ghost = SiteRun(
        run_id="fr-ghost001",
        site_id=settings.site_id,
        pipeline_ref="main.nf",
        shard_ref="s1",
        state=RunState.RUNNING,
        started_at=datetime.now(timezone.utc),
    )
    pre.put(ghost)

    app = create_app(
        settings=settings,
        launcher=FakeLauncher(rows=1, leaky=False),
        bacalhau=_StubBacalhau(alive=True),
    )
    with TestClient(app) as c:
        resp = c.get(f"/v1/runs/{ghost.run_id}")
        assert resp.status_code == 200, resp.text
        payload = resp.json()
        assert payload["state"] == "failed", payload
        assert payload["finished_at"]

"""Shared pytest fixtures for the coordinator test suite."""

from __future__ import annotations

import time
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from site_coordinator.bacalhau import BacalhauClient
from site_coordinator.config import Settings
from site_coordinator.launcher import FakeLauncher
from site_coordinator.main import create_app


class _StubBacalhau(BacalhauClient):
    """Offline double — `is_alive` controllable per-test."""

    def __init__(self, alive: bool = True) -> None:
        super().__init__(base_url="http://unused.invalid")
        self._alive = alive

    async def is_alive(self) -> bool:  # type: ignore[override]
        return self._alive


FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def fixtures_dir() -> Path:
    return FIXTURES_DIR


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        site_id="test-site",
        bacalhau_api_url="http://unused.invalid",
        nextflow_binary="nextflow",
        pipeline_root=tmp_path / "pipeline",
        workdir_root=tmp_path / "runs",
        counts_filename="counts.tsv",
        operator_token="test-token",
    )


@pytest.fixture
def fake_launcher() -> FakeLauncher:
    return FakeLauncher(rows=3, leaky=False)


@pytest.fixture
def leaky_launcher() -> FakeLauncher:
    return FakeLauncher(rows=3, leaky=True)


@pytest.fixture
def client(settings: Settings, fake_launcher: FakeLauncher) -> Iterator[TestClient]:
    app = create_app(
        settings=settings,
        launcher=fake_launcher,
        bacalhau=_StubBacalhau(alive=True),
    )
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def leaky_client(settings: Settings, leaky_launcher: FakeLauncher) -> Iterator[TestClient]:
    app = create_app(
        settings=settings,
        launcher=leaky_launcher,
        bacalhau=_StubBacalhau(alive=True),
    )
    with TestClient(app) as test_client:
        yield test_client


def wait_for_state(
    client: TestClient,
    run_id: str,
    *,
    states: tuple[str, ...],
    timeout: float = 3.0,
) -> dict:
    """Poll GET /v1/runs/{run_id} until state is in ``states``, or fail."""

    deadline = time.monotonic() + timeout
    last: dict = {}
    while time.monotonic() < deadline:
        resp = client.get(f"/v1/runs/{run_id}")
        assert resp.status_code == 200, resp.text
        last = resp.json()
        if last["state"] in states:
            return last
        time.sleep(0.05)
    raise AssertionError(
        f"Run {run_id} never reached {states}; last state={last.get('state')}"
    )

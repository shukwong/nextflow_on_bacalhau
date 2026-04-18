"""FastAPI application for the per-site coordinator agent.

Wires settings, run store, Bacalhau client, launcher, supervisor, and
audit log into a single app via the lifespan context. Designed so tests
can inject a `FakeLauncher` without patching globals.
"""

from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .audit import AuditLog
from .bacalhau import BacalhauClient
from .config import Settings
from .launcher import Launcher, NextflowLauncher
from .routes import counts, healthz, runs
from .store import RunStore
from .supervisor import RunSupervisor

_DEFAULT_DASHBOARD_ORIGINS: tuple[str, ...] = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
)


def new_run_id() -> str:
    return f"fr-{uuid.uuid4().hex[:8]}"


def create_app(
    *,
    settings: Settings | None = None,
    launcher: Launcher | None = None,
    bacalhau: BacalhauClient | None = None,
    run_store: RunStore | None = None,
    allowed_origins: tuple[str, ...] = _DEFAULT_DASHBOARD_ORIGINS,
) -> FastAPI:
    """App factory. All collaborators are injectable for tests."""

    resolved_settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        logging.getLogger().setLevel(logging.INFO)

        app.state.settings = resolved_settings
        app.state.bacalhau = bacalhau or BacalhauClient(resolved_settings.bacalhau_api_url)

        workdir_root = resolved_settings.workdir_root
        workdir_root.mkdir(parents=True, exist_ok=True)

        snapshot_path = workdir_root / "state" / "runs.json"
        app.state.store = run_store or RunStore(snapshot_path=snapshot_path)

        app.state.launcher = launcher or NextflowLauncher()
        app.state.supervisor = RunSupervisor(
            app.state.store, app.state.launcher, resolved_settings
        )
        app.state.audit = AuditLog(workdir_root / "audit" / "counts.jsonl")

        try:
            yield
        finally:
            await app.state.supervisor.shutdown()

    app = FastAPI(
        title="Site Coordinator",
        version=__version__,
        description=(
            "Per-institution agent for the nf-bacalhau federated-AF pipeline. "
            "Launches Nextflow runs, enforces a 6-column privacy invariant on "
            "outputs, and serves counts files to authorised aggregators."
        ),
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(allowed_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    app.include_router(healthz.router, prefix="/v1")
    app.include_router(runs.router, prefix="/v1")
    app.include_router(counts.router, prefix="/v1")

    return app


app = create_app()

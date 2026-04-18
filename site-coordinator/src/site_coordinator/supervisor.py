"""Async supervisor for launched pipeline runs.

Owns the `LaunchHandle` for every in-flight run, polls the launcher off the
event loop, and transitions the `SiteRun` record when the launcher reports
completion. On success, it runs the privacy-invariant check and digests the
counts file so `/v1/counts/{run_id}` can serve it.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path

from .config import Settings
from .invariant import check_counts_file, digest_file
from .launcher import Launcher, LaunchHandle, LaunchSpec
from .models import RunState, SiteRun
from .store import RunStore

_log = logging.getLogger(__name__)


def derive_counts_path(settings: Settings, run_id: str) -> Path:
    """Conventional location of a run's counts file — used after restart."""

    return settings.workdir_root / "runs" / run_id / settings.counts_filename


class RunSupervisor:
    """Launches runs and watches them until terminal state."""

    POLL_INTERVAL_S: float = 1.5

    def __init__(self, store: RunStore, launcher: Launcher, settings: Settings) -> None:
        self._store = store
        self._launcher = launcher
        self._settings = settings
        self._handles: dict[str, LaunchHandle] = {}
        self._tasks: dict[str, asyncio.Task[None]] = {}

    async def start(self, run: SiteRun, spec: LaunchSpec) -> LaunchHandle:
        handle = await asyncio.to_thread(self._launcher.launch, spec)
        self._handles[run.run_id] = handle
        self._store.update(run.run_id, state=RunState.RUNNING)
        task = asyncio.create_task(self._watch(run.run_id), name=f"watch-{run.run_id}")
        self._tasks[run.run_id] = task
        return handle

    async def _watch(self, run_id: str) -> None:
        try:
            while True:
                handle = self._handles[run_id]
                exit_code = await asyncio.to_thread(self._launcher.poll, handle)
                if exit_code is not None:
                    await self._finalize(run_id, exit_code, handle)
                    return
                await asyncio.sleep(self.POLL_INTERVAL_S)
        except asyncio.CancelledError:
            raise
        except Exception:  # pragma: no cover — defensive
            _log.exception("supervisor watcher crashed for run %s", run_id)
            self._store.update(
                run_id,
                state=RunState.FAILED,
                finished_at=datetime.now(timezone.utc),
            )

    async def _finalize(self, run_id: str, exit_code: int, handle: LaunchHandle) -> None:
        if exit_code == 0:
            inv = await asyncio.to_thread(check_counts_file, handle.counts_path)
            digest = (
                await asyncio.to_thread(digest_file, handle.counts_path) if inv.ok else None
            )
            state = RunState.SUCCEEDED if inv.ok else RunState.FAILED
        else:
            inv = None
            digest = None
            state = RunState.FAILED
        self._store.update(
            run_id,
            state=state,
            finished_at=datetime.now(timezone.utc),
            invariant=inv,
            result_digest=digest,
        )

    async def cancel(self, run_id: str) -> bool:
        handle = self._handles.get(run_id)
        if handle is None:
            return False
        await asyncio.to_thread(self._launcher.cancel, handle)
        task = self._tasks.get(run_id)
        if task and not task.done():
            task.cancel()
        self._store.update(
            run_id,
            state=RunState.CANCELLED,
            finished_at=datetime.now(timezone.utc),
        )
        return True

    def counts_path(self, run_id: str) -> Path:
        """Return the counts path for a run, even after restart."""

        handle = self._handles.get(run_id)
        if handle is not None:
            return handle.counts_path
        return derive_counts_path(self._settings, run_id)

    async def shutdown(self) -> None:
        for task in list(self._tasks.values()):
            if not task.done():
                task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks.values(), return_exceptions=True)

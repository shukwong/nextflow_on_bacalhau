"""In-memory run registry with an atomic JSON snapshot on disk.

Good enough for a demo single-tenant coordinator. For production replace
with a real DB (Postgres) — the interface is small on purpose.
"""

from __future__ import annotations

import json
import tempfile
import threading
from datetime import datetime
from pathlib import Path
from typing import Iterator

from .models import InvariantResult, RunState, SiteRun, TaskSnapshot


class RunStore:
    """Thread-safe registry of SiteRun records."""

    def __init__(self, snapshot_path: Path | None = None) -> None:
        self._lock = threading.RLock()
        self._runs: dict[str, SiteRun] = {}
        self._snapshot_path = snapshot_path
        if snapshot_path and snapshot_path.exists():
            self._load()

    def put(self, run: SiteRun) -> None:
        with self._lock:
            self._runs[run.run_id] = run
            self._persist()

    def update(
        self,
        run_id: str,
        *,
        state: RunState | None = None,
        finished_at: datetime | None = None,
        tasks: tuple[TaskSnapshot, ...] | None = None,
        invariant: InvariantResult | None = None,
        result_digest: str | None = None,
    ) -> SiteRun:
        with self._lock:
            existing = self._runs.get(run_id)
            if existing is None:
                raise KeyError(run_id)
            patch: dict[str, object] = {}
            if state is not None:
                patch["state"] = state
            if finished_at is not None:
                patch["finished_at"] = finished_at
            if tasks is not None:
                patch["tasks"] = tasks
            if invariant is not None:
                patch["invariant"] = invariant
            if result_digest is not None:
                patch["result_digest"] = result_digest
            updated = existing.model_copy(update=patch)
            self._runs[run_id] = updated
            self._persist()
            return updated

    def get(self, run_id: str) -> SiteRun | None:
        with self._lock:
            return self._runs.get(run_id)

    def all(self) -> Iterator[SiteRun]:
        with self._lock:
            yield from list(self._runs.values())

    def reset_stale_runs(self, now: datetime) -> int:
        """Mark non-terminal runs as failed on startup.

        Why: when the coordinator restarts, any run still PENDING/RUNNING in
        the snapshot is orphaned — the supervising task and subprocess are
        gone, so the watcher can never finalise it. Leaving them running in
        the store would deadlock the cancel endpoint and mislead the dashboard.
        """
        terminal = {RunState.SUCCEEDED, RunState.FAILED, RunState.CANCELLED}
        reset = 0
        with self._lock:
            for rid, run in list(self._runs.items()):
                if run.state in terminal:
                    continue
                patch: dict[str, object] = {
                    "state": RunState.FAILED,
                    "finished_at": now,
                }
                self._runs[rid] = run.model_copy(update=patch)
                reset += 1
            if reset:
                self._persist()
        return reset

    def __len__(self) -> int:  # noqa: D401 — standard len protocol
        with self._lock:
            return len(self._runs)

    def _persist(self) -> None:
        if not self._snapshot_path:
            return
        self._snapshot_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": 1,
            "runs": {rid: run.model_dump(mode="json") for rid, run in self._runs.items()},
        }
        fd, tmp_name = tempfile.mkstemp(
            prefix=".coord-snapshot-",
            dir=str(self._snapshot_path.parent),
        )
        try:
            with Path(tmp_name).open("w", encoding="utf-8") as fh:
                json.dump(payload, fh, indent=2, default=str)
            Path(tmp_name).replace(self._snapshot_path)
        except Exception:
            Path(tmp_name).unlink(missing_ok=True)
            raise
        finally:
            import os

            try:
                os.close(fd)
            except OSError:
                pass

    def _load(self) -> None:
        assert self._snapshot_path is not None
        try:
            raw = json.loads(self._snapshot_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        for rid, data in (raw.get("runs") or {}).items():
            try:
                self._runs[rid] = SiteRun.model_validate(data)
            except Exception:
                # snapshot schema drift — drop the row rather than crash the agent
                continue

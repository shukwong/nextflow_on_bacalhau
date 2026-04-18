"""Append-only audit log for `/v1/counts/{run_id}` fetches (design §7.3)."""

from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class AuditLog:
    """JSONL audit trail. One line per counts-fetch event."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = threading.Lock()

    @property
    def path(self) -> Path:
        return self._path

    def record_counts_fetch(
        self,
        *,
        run_id: str,
        site_id: str,
        digest: str,
        remote: str | None,
        invariant_ok: bool,
    ) -> None:
        entry: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "event": "counts_fetch",
            "run_id": run_id,
            "site_id": site_id,
            "digest": digest,
            "remote": remote,
            "invariant_ok": invariant_ok,
        }
        self._append(entry)

    def _append(self, entry: dict[str, Any]) -> None:
        with self._lock:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            with self._path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry, default=str) + "\n")

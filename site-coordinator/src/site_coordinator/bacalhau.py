"""Thin async client over the local Bacalhau REST API."""

from __future__ import annotations

from typing import Any

import httpx


class BacalhauClient:
    """Read-only client. The coordinator never submits jobs directly — those
    are owned by the pipeline (Nextflow). We just observe."""

    def __init__(self, base_url: str, *, timeout: float = 5.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    async def is_alive(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(f"{self._base_url}/api/v1/agent/node")
                return resp.status_code < 500
        except httpx.HTTPError:
            return False

    async def list_jobs(self, *, limit: int = 100) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(
                f"{self._base_url}/api/v1/orchestrator/jobs",
                params={"limit": limit},
            )
            resp.raise_for_status()
            payload = resp.json()
            items = payload.get("Items") or []
            return list(items)

    async def get_job(self, job_id: str) -> dict[str, Any] | None:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.get(
                f"{self._base_url}/api/v1/orchestrator/jobs/{job_id}"
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json().get("Job")

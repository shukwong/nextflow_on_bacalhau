"""GET /v1/counts/{run_id} — serve per-site counts.tsv iff invariant passed."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse

from ..models import RunState

router = APIRouter(tags=["counts"])


@router.get("/counts/{run_id}")
async def get_counts(run_id: str, request: Request) -> FileResponse:
    settings = request.app.state.settings
    store = request.app.state.store
    supervisor = request.app.state.supervisor
    audit = request.app.state.audit

    run = store.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Unknown run_id: {run_id}")

    if run.state != RunState.SUCCEEDED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "run is not in succeeded state",
                "state": run.state.value,
            },
        )

    invariant = run.invariant
    if invariant is None or not invariant.ok:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "privacy invariant failed",
                "checks": [c.model_dump() for c in (invariant.checks if invariant else ())],
            },
        )

    counts_path = supervisor.counts_path(run_id)
    if not counts_path.exists():
        raise HTTPException(status_code=404, detail="Counts file missing on disk.")

    audit.record_counts_fetch(
        run_id=run_id,
        site_id=settings.site_id,
        digest=run.result_digest or "",
        remote=request.client.host if request.client else None,
        invariant_ok=invariant.ok,
    )

    return FileResponse(
        path=counts_path,
        media_type="text/tab-separated-values",
        filename=f"{run_id}-counts.tsv",
        headers={"X-Counts-Digest": run.result_digest or ""},
    )

"""POST /v1/runs, GET /v1/runs, GET /v1/runs/{run_id}, POST /v1/runs/{run_id}/cancel."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from ..auth import require_operator
from ..launcher import LaunchSpec
from ..models import RunAcceptance, RunList, RunRequest, RunState, SiteRun

router = APIRouter(tags=["runs"])

_LIST_DEFAULT_LIMIT = 50
_LIST_MAX_LIMIT = 500


@router.post(
    "/runs",
    response_model=RunAcceptance,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_operator)],
)
async def create_run(body: RunRequest, request: Request) -> RunAcceptance:
    from ..main import new_run_id

    settings = request.app.state.settings
    store = request.app.state.store
    supervisor = request.app.state.supervisor

    run_id = new_run_id()
    workdir = settings.workdir_root / "runs" / run_id
    now = datetime.now(timezone.utc)

    site_run = SiteRun(
        run_id=run_id,
        site_id=settings.site_id,
        pipeline_ref=body.pipeline_ref,
        shard_ref=body.shard_ref,
        state=RunState.PENDING,
        started_at=now,
    )
    store.put(site_run)

    spec = LaunchSpec(
        run_id=run_id,
        shard_ref=body.shard_ref,
        pipeline_ref=body.pipeline_ref,
        config_ref=body.config_ref,
        pipeline_root=settings.pipeline_root,
        workdir=workdir,
        nextflow_binary=settings.nextflow_binary,
        counts_filename=settings.counts_filename,
    )
    await supervisor.start(site_run, spec)

    return RunAcceptance(
        run_id=run_id,
        state=RunState.RUNNING,
        site_id=settings.site_id,
        started_at=now,
    )


@router.get("/runs", response_model=RunList)
async def list_runs(
    request: Request,
    limit: int = Query(
        default=_LIST_DEFAULT_LIMIT,
        ge=1,
        le=_LIST_MAX_LIMIT,
        description="Max runs to return (most-recent-first).",
    ),
    state: RunState | None = Query(
        default=None, description="Filter by terminal/non-terminal state."
    ),
) -> RunList:
    store = request.app.state.store
    all_runs = sorted(store.all(), key=lambda r: r.started_at, reverse=True)
    filtered = [r for r in all_runs if state is None or r.state == state]
    return RunList(runs=tuple(filtered[:limit]), total=len(filtered))


@router.get("/runs/{run_id}", response_model=SiteRun)
async def get_run(run_id: str, request: Request) -> SiteRun:
    store = request.app.state.store
    run = store.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Unknown run_id: {run_id}")
    return run


@router.post(
    "/runs/{run_id}/cancel",
    response_model=SiteRun,
    dependencies=[Depends(require_operator)],
)
async def cancel_run(run_id: str, request: Request) -> SiteRun:
    store = request.app.state.store
    supervisor = request.app.state.supervisor

    run = store.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Unknown run_id: {run_id}")
    if run.state in {RunState.SUCCEEDED, RunState.FAILED, RunState.CANCELLED}:
        raise HTTPException(
            status_code=409,
            detail={"reason": "run is already terminal", "state": run.state.value},
        )

    ok = await supervisor.cancel(run_id)
    if not ok:
        raise HTTPException(
            status_code=409,
            detail={
                "reason": "no live handle for run (coordinator may have restarted)",
                "state": run.state.value,
            },
        )
    updated = store.get(run_id)
    assert updated is not None
    return updated

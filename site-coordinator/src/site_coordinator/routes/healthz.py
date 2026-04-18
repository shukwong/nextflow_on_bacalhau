"""GET /v1/healthz — liveness + Bacalhau reachability probe."""

from __future__ import annotations

from fastapi import APIRouter, Request

from .. import __version__
from ..models import Health

router = APIRouter(tags=["health"])


@router.get("/healthz", response_model=Health)
async def healthz(request: Request) -> Health:
    settings = request.app.state.settings
    bacalhau = request.app.state.bacalhau
    reachable = await bacalhau.is_alive()
    return Health(
        ok=True,
        version=__version__,
        site_id=settings.site_id,
        bacalhau_reachable=reachable,
    )

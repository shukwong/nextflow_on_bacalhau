"""Bearer-token gate for operator-only endpoints (POST /runs, cancel)."""

from __future__ import annotations

import secrets

from fastapi import Header, HTTPException, Request, status


async def require_operator(
    request: Request,
    authorization: str | None = Header(default=None),
) -> None:
    """Fail-closed: if the coordinator has no operator token configured,
    every write is denied. If a token is configured, the request must
    present exactly ``Bearer <token>``.
    """

    settings = request.app.state.settings
    expected_token = settings.operator_token
    if not expected_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operator token is not configured on this coordinator.",
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    presented = authorization.removeprefix("Bearer ").strip()
    if not secrets.compare_digest(presented, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

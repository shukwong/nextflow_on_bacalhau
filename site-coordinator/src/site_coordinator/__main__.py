"""Console-script entry point: `site-coordinator` → uvicorn on 0.0.0.0:8080."""

from __future__ import annotations

import os

import uvicorn


def main() -> None:
    host = os.environ.get("COORDINATOR_HOST", "0.0.0.0")  # noqa: S104 — bind all in container
    port = int(os.environ.get("COORDINATOR_PORT", "8080"))
    uvicorn.run(
        "site_coordinator.main:app",
        host=host,
        port=port,
        log_level=os.environ.get("COORDINATOR_LOG_LEVEL", "info"),
        reload=False,
    )


if __name__ == "__main__":
    main()

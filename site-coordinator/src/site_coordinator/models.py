"""Typed API contracts shared with the dashboard — mirrors design §6."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RunState(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


TASK_STATES = Literal["submitted", "running", "completed", "failed"]


class InvariantCheck(BaseModel):
    """One privacy-invariant assertion and the observed value."""

    model_config = ConfigDict(frozen=True)

    name: str
    expected: str
    observed: str
    passed: bool


class InvariantResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    ok: bool
    checks: tuple[InvariantCheck, ...]


class TaskSnapshot(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    bacalhau_job_id: str | None = None
    state: TASK_STATES = "submitted"


class SiteRun(BaseModel):
    """Wire format for GET /v1/runs/{run_id}."""

    run_id: str = Field(description="Coordinator-local run identifier.")
    site_id: str
    pipeline_ref: str = Field(description="Git commit + filename of main.nf.")
    shard_ref: str = Field(description="Opaque shard handle — never a filesystem path.")
    state: RunState
    started_at: datetime
    finished_at: datetime | None = None
    tasks: tuple[TaskSnapshot, ...] = ()
    invariant: InvariantResult | None = None
    result_digest: str | None = Field(
        default=None,
        description="SHA-256 of the per-site counts file once it is available.",
    )


class RunRequest(BaseModel):
    """POST /v1/runs body."""

    model_config = ConfigDict(extra="forbid")

    shard_ref: str = Field(
        min_length=1,
        description="Opaque shard handle known to the pipeline. No filesystem paths.",
    )
    pipeline_ref: str = Field(
        default="main.nf",
        description="Which main.nf to run (relative to the pipeline root).",
    )
    config_ref: str | None = Field(
        default=None,
        description="Optional Nextflow profile name.",
    )


class RunAcceptance(BaseModel):
    run_id: str
    state: RunState
    site_id: str
    started_at: datetime = Field(default_factory=_utcnow)


class Health(BaseModel):
    ok: bool
    version: str
    site_id: str
    bacalhau_reachable: bool
    now: datetime = Field(default_factory=_utcnow)

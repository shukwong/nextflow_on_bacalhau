"""Runtime configuration sourced from environment variables."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings for the coordinator agent.

    Defaults are sized for a local demo: a single operator running one
    coordinator against one local Bacalhau node. Production deployments
    override every field via env vars.
    """

    model_config = SettingsConfigDict(
        env_prefix="COORDINATOR_",
        env_file=".env",
        extra="ignore",
    )

    site_id: str = Field(default="local", description="Opaque site identifier.")
    bacalhau_api_url: str = Field(
        default="http://localhost:1234",
        description="Base URL of the local Bacalhau REST API.",
    )
    nextflow_binary: str = Field(
        default="nextflow",
        description="Path or name of the Nextflow binary in PATH.",
    )
    pipeline_root: Path = Field(
        default=Path.cwd(),
        description=(
            "Directory containing the federated-AF main.nf. Passed to "
            "`nextflow run` as the project dir."
        ),
    )
    workdir_root: Path = Field(
        default=Path("/tmp/site-coordinator-runs"),
        description="Parent directory for per-run workdirs and outputs.",
    )
    counts_filename: str = Field(
        default="counts.tsv",
        description="Per-site aggregate counts filename published by the pipeline.",
    )
    operator_token: str | None = Field(
        default=None,
        description=(
            "Bearer token required for POST /runs and cancel. If unset, all "
            "writes are denied. Reads remain unauthenticated on localhost."
        ),
    )

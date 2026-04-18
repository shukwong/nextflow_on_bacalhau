"""Pluggable pipeline launcher abstraction.

`NextflowLauncher` spawns `nextflow run` as a subprocess and tails the log.
`FakeLauncher` is a deterministic test double that produces a fixture
counts.tsv — used by the pytest suite and by a `--dry-run` flag so a user
can see the coordinator work end-to-end without running any real pipeline.
"""

from __future__ import annotations

import os
import shlex
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol


@dataclass(frozen=True)
class LaunchSpec:
    run_id: str
    shard_ref: str
    pipeline_ref: str
    config_ref: str | None
    pipeline_root: Path
    workdir: Path
    nextflow_binary: str


@dataclass
class LaunchHandle:
    run_id: str
    pid: int | None
    workdir: Path
    counts_path: Path
    started_at: datetime
    log_path: Path


class Launcher(Protocol):
    def launch(self, spec: LaunchSpec) -> LaunchHandle: ...
    def cancel(self, handle: LaunchHandle) -> None: ...
    def poll(self, handle: LaunchHandle) -> int | None:
        """Return exit code if finished, else None."""


class NextflowLauncher:
    """Real launcher — spawns `nextflow run`."""

    def launch(self, spec: LaunchSpec) -> LaunchHandle:
        spec.workdir.mkdir(parents=True, exist_ok=True)
        log_path = spec.workdir / "nextflow.log"
        counts_path = spec.workdir / "counts.tsv"

        cmd = [
            spec.nextflow_binary,
            "run",
            str(spec.pipeline_root / spec.pipeline_ref),
            "-work-dir",
            str(spec.workdir / "work"),
            "-with-report",
            str(spec.workdir / "report.html"),
            "--shard_ref",
            spec.shard_ref,
            "--out_dir",
            str(spec.workdir),
        ]
        if spec.config_ref:
            cmd.extend(["-profile", spec.config_ref])

        env = os.environ.copy()
        env.setdefault("NXF_ANSI_LOG", "false")

        log_fh = log_path.open("wb")
        proc = subprocess.Popen(  # noqa: S603 — command comes from typed config
            cmd,
            stdout=log_fh,
            stderr=subprocess.STDOUT,
            cwd=str(spec.pipeline_root),
            env=env,
            start_new_session=True,
        )
        return LaunchHandle(
            run_id=spec.run_id,
            pid=proc.pid,
            workdir=spec.workdir,
            counts_path=counts_path,
            started_at=datetime.now(timezone.utc),
            log_path=log_path,
        )

    def cancel(self, handle: LaunchHandle) -> None:
        if handle.pid is None:
            return
        try:
            os.killpg(os.getpgid(handle.pid), 15)  # SIGTERM the process group
        except ProcessLookupError:
            pass

    def poll(self, handle: LaunchHandle) -> int | None:
        if handle.pid is None:
            return 0
        try:
            pid, status = os.waitpid(handle.pid, os.WNOHANG)
        except ChildProcessError:
            return 0
        if pid == 0:
            return None
        return os.waitstatus_to_exitcode(status)

    def describe_command(self, spec: LaunchSpec) -> str:
        return shlex.join(
            [
                spec.nextflow_binary,
                "run",
                str(spec.pipeline_root / spec.pipeline_ref),
                "--shard_ref",
                spec.shard_ref,
                "--out_dir",
                str(spec.workdir),
            ]
        )


class FakeLauncher:
    """Deterministic test double.

    Writes a minimal 6-column counts.tsv to the workdir immediately and
    reports exit 0 on the first poll. Used by pytest and by `--dry-run`.
    """

    def __init__(self, *, rows: int = 3, leaky: bool = False) -> None:
        self._rows = rows
        self._leaky = leaky

    def launch(self, spec: LaunchSpec) -> LaunchHandle:
        spec.workdir.mkdir(parents=True, exist_ok=True)
        counts_path = spec.workdir / "counts.tsv"
        header = "CHROM\tPOS\tREF\tALT\tAC\tAN"
        if self._leaky:
            header += "\tHG00096"
        lines = [header]
        for i in range(self._rows):
            row = f"chr1\t{1000 + i}\tA\tG\t{i + 1}\t120"
            if self._leaky:
                row += "\t0/1"
            lines.append(row)
        counts_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        return LaunchHandle(
            run_id=spec.run_id,
            pid=None,
            workdir=spec.workdir,
            counts_path=counts_path,
            started_at=datetime.now(timezone.utc),
            log_path=spec.workdir / "nextflow.log",
        )

    def cancel(self, handle: LaunchHandle) -> None:
        return None

    def poll(self, handle: LaunchHandle) -> int | None:
        return 0

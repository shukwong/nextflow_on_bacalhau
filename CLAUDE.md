# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project overview

This is the **research repository** for privacy-preserving, federated genomics on
[Bacalhau](https://bacalhau.org). It holds the manuscript, the federation tooling
(site coordinator + dashboard), and runnable end-to-end examples. The Nextflow
executor plugin that submits jobs to Bacalhau is a **separate project**:
[`shukwong/nf-bacalhau`](https://github.com/shukwong/nf-bacalhau). This repo
consumes that plugin as a published artifact (`plugins { id 'nf-bacalhau@...' }`)
and contains **no** plugin source or Gradle build.

## Components & scope

| Path | Stack | Purpose |
|---|---|---|
| `examples/plink-gwas/` | Nextflow + PLINK (bioconda) | Federated GWAS meta-analysis demo + `check.sh` reproducibility/privacy gate |
| `examples/federated-af/` | Nextflow + bcftools | Federated allele-frequency aggregation demo |
| `site-coordinator/` | Python 3.12, FastAPI, hatchling | Per-site coordinator (supervisor, auth, audit, launcher). Demo security. |
| `dashboard/` | Next.js, TypeScript | Federation dashboard. Demo security. |
| `manuscript/` | Markdown | Applications-note manuscript + figures |
| `docs/` | MkDocs (material) | Documentation site |

## Development commands

```bash
# Examples — need Docker, the bacalhau CLI, Nextflow 24.10.x, and the nf-bacalhau plugin.
# Build the plugin from a local checkout, or pass --skip-build to use a registry-installed one.
NF_BACALHAU_REPO=~/GIT/nf-bacalhau ./examples/plink-gwas/run.sh
./examples/federated-af/run.sh

# Site coordinator
cd site-coordinator && pip install -e ".[dev]" && ruff check . && mypy && pytest

# Dashboard
cd dashboard && npm ci && npm run typecheck && npm test && npm run build

# Docs
mkdocs serve
```

## Important constraints

- **Nextflow 24.10.x (LTS) only.** The `nf-bacalhau` plugin rejects 25.x at
  runtime. Run examples with `NXF_VER=24.10.0`. The Homebrew `nextflow` launcher
  is version-pinned and ignores `NXF_VER`; use the official launcher to select
  24.10.
- **The plugin is external.** Executor behavior, job translation, and the Gradle
  build live in [`shukwong/nf-bacalhau`](https://github.com/shukwong/nf-bacalhau).
  Do not add plugin source here.
- **Coordinator/dashboard are demo security** (one shared bearer token; tokens in
  `localStorage`). Don't present them as production-ready. See [SECURITY.md](SECURITY.md).
- **Privacy invariant.** The examples' value is that only aggregate statistics
  leave a task; `check.sh` enforces "no sample-level identifier in any output."
  Preserve that property in any change to an example.

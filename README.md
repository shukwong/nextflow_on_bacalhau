# Federated Genomics on Bacalhau

Research stack for **privacy-preserving, federated genomics** on
[Bacalhau](https://bacalhau.org) — compute-to-data pipelines where each site's
genotypes stay home and only aggregate statistics cross the network.

This repository is the **research / federation** home: the manuscript, the
federation tooling (site coordinator + dashboard), and runnable end-to-end
examples. The Nextflow executor that submits work to Bacalhau lives in its own
repository:

> **Plugin:** [`shukwong/nf-bacalhau`](https://github.com/shukwong/nf-bacalhau)
> — the `nf-bacalhau` Nextflow executor plugin (installable from the Nextflow
> Plugin Registry). This repo consumes it as a published artifact and contains
> no plugin source or Gradle build.

## What's here

| Component | Path | What it is |
|---|---|---|
| **Examples** | `examples/plink-gwas/`, `examples/federated-af/` | Runnable federated pipelines: a PLINK GWAS meta-analysis and an allele-frequency aggregation, each keeping per-site genotypes local |
| **Site coordinator** | `site-coordinator/` | FastAPI service (supervisor, auth, audit, launcher) for running a node per site — **demo security, see below** |
| **Dashboard** | `dashboard/` | Next.js federation dashboard for registering sites and launching runs — **demo security** |
| **Manuscript** | `manuscript/` | The applications-note manuscript and figures |

## Quickstart — the federated GWAS demo

Runs a per-cohort PLINK GWAS next to each cohort's data on a local Bacalhau
node, then meta-analyses the per-SNP summaries — individual genotypes never
leave a task.

**Prerequisites:** Docker, the `bacalhau` CLI, **Nextflow 24.10.x** (the plugin
requires 24.10 LTS and rejects 25.x — run with `NXF_VER=24.10.0`), Java 17+,
Python 3, and the `nf-bacalhau` plugin (from the registry, or built from a local
checkout via `NF_BACALHAU_REPO=/path/to/nf-bacalhau`).

```bash
# using a local plugin checkout:
NF_BACALHAU_REPO=~/GIT/nf-bacalhau ./examples/plink-gwas/run.sh
# or, once the plugin is installed from the registry:
./examples/plink-gwas/run.sh --skip-build
```

The runner stages the plugin, starts a local node, generates synthetic cohorts,
runs the pipeline, and verifies the privacy invariant
(`examples/plink-gwas/check.sh`): the meta-analysis pools per-SNP records across
cohorts and **no sample-level identifier leaves any task**.

See [`examples/plink-gwas/README.md`](examples/plink-gwas/README.md) and the
[federated allele-frequency example](examples/federated-af/README.md).

## The privacy story

The compute-to-data case for federated genomics: each institution's genotype
matrix is mounted **read-only** into a task that runs next to it, and only
per-SNP association statistics (or integer allele counts) are written back. The
example runners assert this automatically. It is a *verifiable property of the
outputs*, not a compliance certification — see each example's limitations.

## Federation tooling — demo security ⚠️

`site-coordinator/` and `dashboard/` let you run a coordinator per site and drive
runs from a dashboard. They are **demonstration components**: the coordinator's
`/runs` and `/counts` routes use a single shared bearer token for both read and
write, and the dashboard stores operator tokens in browser `localStorage`. Use
them only on trusted workstations/networks. See [SECURITY.md](SECURITY.md).

## Documentation

Built with MkDocs (`mkdocs serve`); see [`docs/`](docs/) — the federation
dashboard guide, examples, and status. Executor/plugin documentation lives in the
[plugin repo](https://github.com/shukwong/nf-bacalhau).

## License

Apache License 2.0 — see [LICENSE](LICENSE).

## Support

- [GitHub Issues](https://github.com/shukwong/nextflow_on_bacalhau/issues)
- [Bacalhau docs](https://docs.bacalhau.org) · [Nextflow community](https://community.nextflow.io)

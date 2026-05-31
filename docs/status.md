# Status & Roadmap

This repository is the **federated-genomics research stack**. The `nf-bacalhau`
executor plugin it builds on has its own status in the
[plugin repo](https://github.com/shukwong/nf-bacalhau); this page tracks the
research components.

## What works

- [x] **Federated PLINK GWAS example** (`examples/plink-gwas/`) — runs end to end
  on a local Bacalhau node (Nextflow 24.10.0): per-cohort GWAS plus
  inverse-variance meta-analysis, with `check.sh` verifying the privacy invariant.
- [x] **Federated allele-frequency example** (`examples/federated-af/`).
- [x] **Site coordinator** (`site-coordinator/`) — FastAPI supervisor / auth /
  audit / launcher, with `ruff` / `mypy` / `pytest`.
- [x] **Federation dashboard** (`dashboard/`) — Next.js site registration and run
  launching.

## In progress / planned

- [ ] Multi-site deployment guide and reference topology.
- [ ] Harden the coordinator/dashboard beyond demo security (per-principal
  tokens, server-side secret store) — see below.
- [ ] Multi-node / cross-site benchmarking for the manuscript.
- [ ] Expanded examples and documentation.

## Known limitations

- **Demo security.** Coordinator `/runs` and `/counts` require the configured
  bearer token, but the demo uses one shared token for read and write, and
  dashboard operator tokens are kept in browser `localStorage`. Treat as
  demonstration software — see
  [SECURITY.md](https://github.com/shukwong/nextflow_on_bacalhau/blob/main/SECURITY.md).
- **Nextflow 24.10.x only**, inherited from the plugin — run examples with
  `NXF_VER=24.10.0`.
- **Local-path staging requires path visibility** — compute nodes must see the
  referenced paths; use S3 inputs for remote object data.
- **Not a compliance certification.** "Only summary statistics leave a task" is a
  verifiable output property, not HIPAA/GDPR certification.

## Where to get help

- **Research-stack issues**: [shukwong/nextflow_on_bacalhau/issues](https://github.com/shukwong/nextflow_on_bacalhau/issues)
- **Plugin issues**: [shukwong/nf-bacalhau](https://github.com/shukwong/nf-bacalhau)
- **Bacalhau docs**: [docs.bacalhau.org](https://docs.bacalhau.org)

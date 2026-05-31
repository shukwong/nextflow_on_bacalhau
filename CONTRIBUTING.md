# Contributing

Thanks for helping improve the federated-genomics stack.

Contributions to the **`nf-bacalhau` executor plugin** itself go to its own
repository: <https://github.com/shukwong/nf-bacalhau>. This repo is the
research / federation stack (examples, coordinator, dashboard, manuscript).

Before opening a pull request, run the checks for the component you touched:

- **Site coordinator** (`site-coordinator/`): `pip install -e ".[dev]"`, then
  `ruff check .`, `mypy`, and `pytest`.
- **Dashboard** (`dashboard/`): `npm ci`, then `npm run typecheck`, `npm test`,
  `npm run build`, and `npm audit --audit-level=high`.
- **Examples**: run the example end-to-end where feasible
  (`NF_BACALHAU_REPO=/path/to/nf-bacalhau ./examples/plink-gwas/run.sh`) and keep
  `check.sh` passing — the privacy invariant (no sample-level identifier in any
  output) must hold.
- Update `docs/` and the manuscript when behavior or user-facing limitations change.

Running the examples needs Docker, the `bacalhau` CLI, Nextflow 24.10.x
(`NXF_VER=24.10.0`), and the `nf-bacalhau` plugin (from the registry, or built
from a local checkout via `NF_BACALHAU_REPO`).

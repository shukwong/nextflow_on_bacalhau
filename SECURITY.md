# Security Policy

This repository is pre-1.0 and should be treated as experimental.

## Reporting

Please report suspected vulnerabilities privately to the repository owner before
opening a public issue. Include:

- affected commit or release,
- affected component (`site-coordinator` or `dashboard`),
- reproduction steps,
- expected impact,
- any relevant logs with secrets removed.

Vulnerabilities in the `nf-bacalhau` executor plugin belong in the
[plugin repository](https://github.com/shukwong/nf-bacalhau).

## Current boundaries

The federation tooling here is **demonstration software**, not a hardened
deployment:

- The site coordinator protects `/runs` and `/counts` with a static operator
  bearer token. The demo uses **one shared token for both read and write**
  privileges (`site-coordinator/src/site_coordinator/auth.py` implements
  constant-time comparison correctly — the *policy* is the demo limitation).
- The dashboard stores coordinator operator tokens in browser `localStorage`.
  Use it only from trusted workstations until a server-side secret store exists.
- The examples mount each cohort's genotypes **read-only** into a task and write
  back only per-SNP / aggregate statistics. `examples/*/run.sh` (and
  `examples/plink-gwas/check.sh`) verify that no sample-level identifier leaks
  into an output. This is a property you can check — not a HIPAA/GDPR
  certification, which depends on your data-use agreements and controls.

## Running the examples

- Examples shell out to the local `bacalhau` CLI via the `nf-bacalhau` plugin.
  Protect the submit host and its Nextflow work directories.
- Local-path staging requires the Bacalhau compute node to have access to the
  referenced paths. Do not allowlist sensitive host paths on shared nodes.

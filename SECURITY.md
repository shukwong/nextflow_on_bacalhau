# Security Policy

This repository is pre-1.0 and should be treated as experimental.

## Reporting

Please report suspected vulnerabilities privately to the repository owner before opening a public issue. Include:

- affected commit or release,
- affected component (`nf-bacalhau`, `site-coordinator`, or `dashboard`),
- reproduction steps,
- expected impact,
- any relevant logs with secrets removed.

## Current Boundaries

- The executor shells out to the local `bacalhau` CLI. Protect the submit host, its environment, and its Nextflow work directories.
- Local-path staging requires the Bacalhau compute node to have access to the referenced paths. Do not allowlist sensitive host paths on shared compute nodes.
- The site coordinator currently protects `/runs` and `/counts` endpoints with a static operator bearer token. The demo uses one token for both read and write privileges.
- The dashboard stores coordinator operator tokens in browser `localStorage`. Use it only from trusted workstations until a server-side secret store is implemented.

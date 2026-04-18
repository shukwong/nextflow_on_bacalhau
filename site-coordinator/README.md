# site-coordinator

Per-institution FastAPI agent for the `nf-bacalhau` federated allele-frequency
pipeline. Launches per-shard Nextflow runs, enforces the 6-column privacy
invariant on outputs, and serves `counts.tsv` to authorised aggregators — so
the dashboard can show "three sites green" without ever touching raw genotypes.

Part of M3 in [`design/federation-dashboard.md`](../design/federation-dashboard.md).
For the stitched end-to-end workflow (coordinator + dashboard), see
[`docs/federation-dashboard.md`](../docs/federation-dashboard.md).

## What it does

- **Launches** the federated-AF pipeline as an isolated subprocess per run.
- **Watches** the launcher handle asynchronously and transitions run state
  (`pending → running → succeeded / failed / cancelled`).
- **Re-runs the privacy invariant** (column count, header names, sample-ID
  detection, row shape, size bound) on every completed run. If any check
  fails, `/counts` returns `409 Conflict` — the data never leaves the site.
- **Digests** `counts.tsv` with SHA-256 for the audit trail.
- **Logs** every `/counts` fetch as append-only JSONL.

## API

All routes live under `/v1`.

| Method | Route | Auth | Purpose |
|---|---|---|---|
| `GET` | `/healthz` | none | Liveness + Bacalhau reachability |
| `POST` | `/runs` | `Bearer` | Launch a run. Body: `{shard_ref, pipeline_ref?, config_ref?}` |
| `GET` | `/runs/{run_id}` | none | Run status + task snapshots + invariant |
| `POST` | `/runs/{run_id}/cancel` | `Bearer` | Cancel an in-flight run |
| `GET` | `/counts/{run_id}` | none* | Stream `counts.tsv` iff invariant passed |

`*` Counts is read-only by design; in production this route is protected by
the aggregator token (M4+).

The full spec lives at `GET /openapi.json` once the service is running.

## Install

```bash
cd site-coordinator
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
```

Python 3.12+ is required.

## Run

```bash
# Copy env template and fill in
cp .env.example .env
# Edit .env — at minimum set COORDINATOR_OPERATOR_TOKEN to a strong value

site-coordinator   # starts uvicorn on 0.0.0.0:8080
```

Or directly:

```bash
uvicorn site_coordinator.main:app --reload --port 8080
```

## Configuration

All settings are env-var driven with the `COORDINATOR_` prefix. See
[`.env.example`](./.env.example) for the full list.

| Variable | Default | Notes |
|---|---|---|
| `COORDINATOR_SITE_ID` | `local` | Opaque identifier surfaced in `/healthz` and audit |
| `COORDINATOR_BACALHAU_API_URL` | `http://localhost:1234` | Local Bacalhau REST |
| `COORDINATOR_NEXTFLOW_BINARY` | `nextflow` | Must be in `PATH` |
| `COORDINATOR_PIPELINE_ROOT` | cwd | Dir containing `main.nf` |
| `COORDINATOR_WORKDIR_ROOT` | `/tmp/site-coordinator-runs` | Per-run workdirs + state snapshot |
| `COORDINATOR_COUNTS_FILENAME` | `counts.tsv` | Published artefact name |
| `COORDINATOR_OPERATOR_TOKEN` | _(unset)_ | Required for `POST /runs` and cancel |

If `OPERATOR_TOKEN` is unset, every write returns `403` (fail-closed).

## Test

```bash
pytest
```

Tests use an injected `FakeLauncher` that writes a deterministic counts file
— no Nextflow, no Bacalhau, fully offline.

## Connecting from the dashboard

The federation dashboard talks to this API directly from the browser (there
is no server-side proxy), so CORS must allow the dashboard's origin.

- Default: `http://localhost:3000` is allowed out of the box.
- For any other dashboard origin, update `allowed_origins` in
  `src/site_coordinator/main.py` or wrap the coordinator in a reverse proxy
  that injects the correct `Access-Control-Allow-Origin` header.

On the dashboard side, open **Sites → Add site** and paste:

- this coordinator's public URL (e.g. `https://coord.site-a.example`)
- the `COORDINATOR_OPERATOR_TOKEN` value you configured

A green health pill within ~10 seconds confirms the wiring. See
[`docs/federation-dashboard.md`](../docs/federation-dashboard.md) for the
full end-to-end walkthrough.

## Privacy model

The coordinator re-implements the invariant checks from the federated-AF
demo's `run.sh` so the aggregator can't pull leaky data even if a site's
pipeline is misconfigured. The schema contract is:

```
CHROM  POS  REF  ALT  AC  AN       (6 columns, tab-delimited)
```

Any header containing `HG\d+`, `NA\d+`, `SAMPLE*`, `FORMAT`, `GT`, `GENOTYPE`,
or `IND*` fails the `no_sample_ids` check and the run is marked `failed`.

See [design §7](../design/federation-dashboard.md) for the full model.

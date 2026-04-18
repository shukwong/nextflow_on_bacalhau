# Federation dashboard (end-to-end usage)

The federation dashboard and the per-site coordinator ship as two separate
processes — one deployed at each institution and one run by whoever aggregates
the federation. This page walks through wiring them together from scratch and
running your first federated allele-frequency job.

- **site-coordinator** — Python / FastAPI. One per institution. Launches
  Nextflow runs, enforces privacy invariants, serves `counts.tsv`.
- **dashboard** — Next.js. Runs once (per operator). Talks to any number of
  coordinator URLs you register in its UI.

The dashboard is a thin client: the browser calls each coordinator directly,
so anything on your network that is allowed to reach the coordinator port
will work.

## 1. Run a coordinator at each site

At each site:

```bash
cd site-coordinator
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
# Edit .env — at minimum set COORDINATOR_OPERATOR_TOKEN and COORDINATOR_SITE_ID
site-coordinator          # starts uvicorn on 0.0.0.0:8080
```

Sanity-check the install:

```bash
curl -s http://localhost:8080/v1/healthz | jq
# { "ok": true, "version": "…", "site_id": "…", "bacalhau_reachable": true, ... }
```

Record two things per site: the coordinator's **public URL** (as reachable
from wherever the dashboard runs) and the **operator token** you set in
`.env`. Share these with the operator who runs the dashboard; everything else
stays at the site.

See [`site-coordinator/README.md`](https://github.com/shukwong/nextflow_on_bacalhau/blob/main/site-coordinator/README.md)
for the full env-var reference.

## 2. Allow the dashboard's origin in CORS

The dashboard calls the coordinator from the browser, so the coordinator must
advertise CORS headers for the dashboard's origin. By default the coordinator
allows `http://localhost:3000`. If the dashboard runs elsewhere, update the
`allowed_origins` list for the coordinator (see `site-coordinator/src/site_coordinator/main.py`).

For production, front the coordinator with a reverse proxy that:

- Terminates TLS
- Adds CORS for your dashboard origin
- Gates writes (`POST /v1/runs`, `POST /v1/runs/{id}/cancel`) on the operator
  token header the coordinator already expects

## 3. Run the dashboard

```bash
cd dashboard
npm install
npm run dev     # → http://localhost:3000
```

On first load you'll see an onboarding page — "Register your first site
coordinator". Click **Add site** (or **Sites** in the nav) and fill in:

- **Label** — human-friendly name (e.g. `Site A — Oxford`).
- **Coordinator URL** — e.g. `https://coord.site-a.example`. Trailing slashes
  are stripped automatically.
- **Operator token** — the `COORDINATOR_OPERATOR_TOKEN` value from that site's
  `.env`. Required for POSTs; `/v1/healthz` and `/v1/runs/{id}` work without
  it.

Repeat for every site you aggregate. A green health pill within ~10 seconds
means the dashboard can reach that coordinator and it's responding.

!!! warning "Tokens live in the browser"
    Operator tokens are kept in `localStorage` under the
    `federation-sites-v1` key. An XSS in the dashboard would leak them.
    This is an MVP trade-off documented in the design doc; the upgrade path
    is a server-side secret store. Until then, treat each operator's browser
    as the trust boundary and rotate tokens if a workstation is ever
    compromised.

## 4. Launch a run

Writing a run against a single site from a terminal:

```bash
curl -s -X POST https://coord.site-a.example/v1/runs \
  -H "Authorization: Bearer $COORDINATOR_OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"shard_ref": "s3://my-bucket/site-a/shard-000.vcf.gz"}'
# → { "run_id": "…", "state": "pending", "site_id": "…", "started_at": "…" }
```

Within a couple of seconds the run appears in the dashboard's federation
table with state `pending → running`. Click its id to open the detail view.

### What the detail view shows

- **State card** — `pending / running / succeeded / failed / cancelled`,
  site id, started & finished timestamps.
- **Tasks** — each Nextflow task, its `bacalhau_job_id` once Bacalhau has
  accepted the task, and its state.
- **Invariant panel** — once the run completes, the coordinator re-scans the
  produced `counts.tsv`. If any check fails, the run moves to `failed` and
  the counts download is blocked. The panel shows which check failed, the
  expected shape, and what was observed.
- **Download counts.tsv** — only rendered when state is `succeeded` *and* the
  invariant passed. The click streams the file from the coordinator directly.
- **Cancel** — posts `/v1/runs/{id}/cancel`. If the coordinator restarted
  and lost the launcher handle, this returns `409` with a reason; the run
  will have been marked `failed` on restart already.

## 5. The federation view

Back on `/`, the dashboard shows:

- One **health card per site** — coordinator version, Bacalhau reachability,
  last error if the probe failed.
- **All runs across all sites**, merged and sorted most-recent first. Each
  row shows which site produced the run and links to the detail view.

Both panels poll every 5 seconds; an unreachable coordinator doesn't block
the rest — each site has its own query so failures are isolated.

## Privacy end-to-end

The dashboard never displays or stores genotype data. The type system
enforces this client-side: every field in `coordinator-types.ts` maps 1:1 to
the coordinator's Pydantic models, which deliberately exclude per-sample
data. The coordinator refuses to publish `counts.tsv` until its invariants
pass.

The full invariant contract:

1. **6 columns exactly**, tab-delimited, header `CHROM POS REF ALT AC AN`.
2. **No sample-id headers** — anything matching `HG\d+`, `NA\d+`, `SAMPLE*`,
   `FORMAT`, `GT`, `GENOTYPE`, `IND*` fails `no_sample_ids`.
3. **Every data row has 6 fields** — no leaky rows.
4. **Size bound** — files above `MAX_FILE_BYTES` are rejected.

If any check fails on a completed run, the coordinator marks the run
`failed`, records the failing check in the run's `invariant.checks`, and
returns `409 Conflict` on `/v1/counts/{run_id}`. The data never leaves the
site.

## Common issues

**"Failed to fetch" on every site health card.**
The coordinator is not reachable or CORS is not configured. Test from your
machine: `curl -v https://coord.site.example/v1/healthz`. Fix network/DNS
before touching CORS.

**"HTTP 401" on launch but green health.**
Operator token is missing or wrong. `/v1/healthz` is unauthenticated, so
green health + failing writes is the token-is-wrong signature.

**Dashboard shows no runs.**
Each coordinator only knows about its own runs. If you launched against a
coordinator the dashboard doesn't have registered, the run is invisible
until you add that site. Confirm with
`curl $COORD/v1/runs` using any operator token.

**Tokens show up in another operator's browser.**
They won't — `localStorage` is per-origin-per-profile. Each operator needs
to register their own copies in their own browser.

## What's next

See [`design/federation-dashboard.md`](https://github.com/shukwong/nextflow_on_bacalhau/blob/main/design/federation-dashboard.md)
for the multi-milestone roadmap: dashboard-driven run launch form, NATS
federation mode for cross-site cancellation, and server-side secret store
for operator tokens.

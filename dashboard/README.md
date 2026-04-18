# Federation Dashboard

Web UI for the **nf-bacalhau** federated allele-frequency demo. The dashboard
connects to one or more **site-coordinator** HTTP APIs — one per institution —
and shows live run state, privacy-invariant status, and `counts.tsv` handoffs
across the federation.

> See [`design/federation-dashboard.md`](../design/federation-dashboard.md) for
> the multi-milestone plan and [`docs/federation-dashboard.md`](../docs/federation-dashboard.md)
> for the stitched end-to-end usage guide (coordinator + dashboard together).

## Requirements

- Node.js ≥ 18.17
- One or more reachable [site-coordinator](../site-coordinator/README.md)
  instances — the dashboard talks to their `/v1/*` endpoints directly from the
  browser.
- Each coordinator's `allowed_origins` must include the dashboard's URL
  (defaults to `http://localhost:3000`).

## Quick start

```bash
cd dashboard
npm install
npm run dev
# → http://localhost:3000
```

On first launch the dashboard is empty — you need to register at least one
coordinator:

1. Click **Sites** in the top nav (or the "Add site" CTA on the empty home
   page).
2. Fill in a **Label** (e.g. `Site A — Oxford`), the coordinator's public URL
   (e.g. `https://coord.site-a.example`), and the **Operator token** if the
   coordinator has `COORDINATOR_OPERATOR_TOKEN` set.
3. Save. The row's health pill turns green within ~10s if the coordinator
   responds to `GET /v1/healthz`.

Repeat for each site. The first site becomes "active" automatically; click the
circle in the **Active** column to change it.

## Using the dashboard

### Home (`/`) — federation view

Once at least one coordinator is registered, the home page shows:

- A health card per configured site (coordinator version, `bacalhau_reachable`,
  last-probe error if unreachable).
- A merged run list across all sites, sorted by `started_at` descending. Each
  row links to the run-detail page.
- A "Polling…" indicator while any coordinator is being re-fetched
  (default: 5 s health, 5 s runs).

If no sites are configured, the home page is an onboarding screen pointing at
`/settings`.

### Run detail (`/sites/{siteId}/runs/{runId}`)

Per-run view showing:

- **State card** — state, site id, started/finished timestamps
- **Tasks** — each Nextflow task with its Bacalhau job id and state
- **Invariant panel** — the privacy checks the coordinator ran on `counts.tsv`
  (6 columns, no sample-id headers, bounded size). Failures block the counts
  download.
- **Download counts.tsv** — shown when state is `succeeded` and invariant
  passed. Streams directly from `{coordinatorUrl}/v1/counts/{runId}`.
- **Cancel** — POSTs `/v1/runs/{runId}/cancel`. Non-terminal runs only.

### Settings (`/settings`) — manage sites

- Add / edit / delete sites.
- Mask + copy operator token (it never leaves the browser otherwise).
- Live health pill per row so you can diagnose a broken coordinator before
  trying to launch a run against it.

## Where data lives

| Data | Storage | Notes |
|---|---|---|
| Site list + active-site id | `localStorage['federation-sites-v1']` | Zod-validated on every load. |
| Operator tokens | Same | See design doc §10 — an XSS here would leak them. MVP trade-off; the upgrade path is a server-side secret store. |
| Runs, tasks, invariants, counts.tsv | Site coordinator | Dashboard never caches across reloads — it re-polls on mount. |

The dashboard does **not** proxy the coordinator; all calls are browser →
coordinator. That keeps the dashboard stateless but requires the coordinator
to allow the dashboard's origin in its CORS config.

## Scripts

```bash
npm run dev        # Dev server on :3000
npm run build      # Production build (standalone output)
npm run start      # Run the built bundle
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
npm test           # vitest run (unit + context tests)
npm run test:watch # vitest in watch mode
```

## File map

```
src/
├── app/
│   ├── page.tsx                         # Federation home (all sites)
│   ├── settings/page.tsx                # Site CRUD + health pills
│   ├── sites/[siteId]/runs/[runId]/     # Per-run detail
│   ├── pooled-af/                       # M2 pooled-AF viewer
│   ├── jobs/[id]/                       # M1 Bacalhau job inspector
│   └── providers.tsx                    # QueryClient + SitesProvider
├── components/                          # Presentational building blocks
├── hooks/
│   ├── use-bacalhau.ts                  # M1 single-node polling
│   └── use-coordinator.ts               # M4 multi-site fan-out
└── lib/
    ├── coordinator.ts                   # Typed HTTP client
    ├── coordinator-types.ts             # TS mirror of Pydantic models
    ├── sites-context.tsx                # React context + reducer
    └── sites-storage.ts                 # localStorage (Zod-validated)
```

## Troubleshooting

**Health pill is red with "Failed to fetch".**
The coordinator isn't reachable, or its CORS doesn't include this origin.
`curl -v https://coord.site.example/v1/healthz` from your machine first;
fix network/DNS before touching CORS.

**Health pill is red with "HTTP 401".**
Operator token is missing or stale. Edit the site and paste the right one.
`/v1/healthz` itself doesn't require auth, but the dashboard's other calls do
— if health is green and only runs/cancel fail, the token is the suspect.

**Runs list is empty but I launched one.**
Check that you launched against the correct coordinator URL. The dashboard
lists runs per coordinator — it won't find runs from a coordinator you
haven't registered.

**"Privacy invariant" panel shows red.**
The coordinator refused to publish `counts.tsv` because a check failed
(column count, sample-id headers, size bound). This is by design — fix the
pipeline output; do not bypass the coordinator.

## Privacy

The dashboard never displays or stores genotype data. Types in
`src/lib/coordinator-types.ts` structurally forbid per-sample fields, and the
coordinator refuses to publish `counts.tsv` unless its invariants pass. See
[`design/federation-dashboard.md §7`](../design/federation-dashboard.md) for
the end-to-end contract.

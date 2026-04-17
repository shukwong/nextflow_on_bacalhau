# Federation Coordination Dashboard — Design Spec

**Status:** draft · **Owner:** Wendy Wong · **Created:** 2026-04-17

A web UI that lets participants in a federated-genomics study **configure and
start pipeline runs at their own site** and view federation-level status
without ever surfacing per-patient genotypes.

The dashboard is not a replacement for [Seqera Platform][tower]. It targets
the *federation-specific* problem that Platform does not solve out of the
box: showing, in a single view, that multiple independent sites have each
completed their per-shard reduction and that the privacy invariant holds
across all of them.

[tower]: https://seqera.io/platform/

---

## 1. Goals

- **G1.** A site operator can, with one click, configure and start a
  per-shard `computeSiteCounts` run on their own Bacalhau node.
- **G2.** Any participant can see, live, the federation-level status:
  which sites have submitted, which have completed, whether any shard
  failed.
- **G3.** The privacy invariant (6-col per-shard TSV, 7-col pooled TSV,
  zero sample-ID leakage) is verified and displayed as a continuously-updated
  indicator, not just at the end.
- **G4.** The aggregator's `pooled_af.tsv` is viewable in-browser with a
  quick Manhattan-style AF plot.
- **G5.** Entirely self-hostable. No external SaaS required. Works against
  a local Bacalhau node for the demo and against per-site coordinator
  agents for a real multi-institution deployment.

## 2. Non-goals

- **NG1.** Pipeline authoring, a DAG editor, or a general-purpose run
  manager. Use Seqera Platform for that.
- **NG2.** User management, RBAC, SSO. Out of scope for v1 — the
  federation is a small set of institutions that pre-share tokens.
- **NG3.** Storing per-shard raw data anywhere. The dashboard never sees
  genotypes; it only polls for aggregate status and fetches the final
  pooled table.
- **NG4.** Re-implementing Bacalhau's REST API or Nextflow's execution
  engine. The dashboard is a read-mostly view over both.

## 3. Deployment topologies

Two modes, both shipped. The demo uses Hub; real deployments use Federated.

### 3.1 Hub mode (demo / single-tenant)

```
                      ┌──────────────────────┐
                      │  Dashboard (Next.js) │
                      │  + Aggregator role   │
                      └──────────┬───────────┘
                                 │
           ┌─────────────────────┼────────────────────┐
           ▼                     ▼                    ▼
  Site A Bacalhau API   Site B Bacalhau API   Site C Bacalhau API
  (token-protected)     (token-protected)     (token-protected)
```

One dashboard instance at the aggregator institution polls each site's
Bacalhau REST API directly. Each site issues a read-only token scoped to
its jobs. This is what the federated-AF demo ships with.

### 3.2 Federated mode (production)

```
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │ Dashboard A  │    │ Dashboard B  │    │ Dashboard C  │
   │ Coordinator  │    │ Coordinator  │    │ Coordinator  │
   │ (own site)   │    │ (own site)   │    │ (own site)   │
   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
          │                    │                    │
   Site A Bacalhau      Site B Bacalhau      Site C Bacalhau
          │                    │                    │
          └────── gossip / pub-sub relay ───────────┘
```

Each site runs its own dashboard + coordinator agent. Coordinators publish
per-site status (job-count, state-count, invariant-check) to a shared relay
(Redis Streams / NATS / lightweight Postgres). No site ever sees another
site's raw Bacalhau API. This is the model to describe in the manuscript.

## 4. Components

### 4.1 `site-coordinator` (per-site agent)

A small Go or Python service running at each institution. Responsibilities:

- Expose a **typed REST API** scoped to this site.
- Wrap `nextflow run` to start / resume / cancel the per-shard pipeline.
- Poll the local Bacalhau node and emit *aggregate* status events.
- Compute the privacy invariant for this site's outputs (col counts,
  sample-ID regex) and publish pass/fail — never the outputs themselves.
- Publish the final `<site>.counts.tsv` to the aggregator's staging area
  when asked (pull-based; the agent controls when/what leaves).

Minimal API:

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/runs` | Start a per-shard run. Body: `{shard_path, bacalhau_node, config_ref}`. Returns `run_id`. |
| `GET` | `/v1/runs/{run_id}` | Status: `{state, tasks: [...], started_at, finished_at, invariant: {ok, checks}}` |
| `POST` | `/v1/runs/{run_id}/cancel` | Cancel. Terminal. |
| `GET` | `/v1/counts/{run_id}` | Return this site's `counts.tsv` for aggregation. **Only after invariant passes.** |
| `GET` | `/v1/healthz` | Liveness. |

### 4.2 `federation-dashboard` (Next.js app)

Single-page app (SPA with server actions). Talks to one or more
site-coordinators (Federated mode) or directly to Bacalhau APIs (Hub mode).

Pages:

1. **`/`** — Overview. Site grid + federation timeline + invariant banner.
2. **`/sites/[id]`** — Per-site detail: Bacalhau node health, last 10 runs,
   current task states, local invariant check, `nextflow.config` viewer.
3. **`/runs/[id]`** — Federation run detail: waterfall of per-site tasks,
   aggregator task, pooled-AF preview + Manhattan plot.
4. **`/settings`** — Configure sites (URL, token), aggregator target,
   shard definitions. Stored in a local SQLite (Hub) or per-site secret
   store (Federated).

## 5. Tech stack

| Layer | Choice | Why |
|---|---|---|
| UI framework | **Next.js 14 (App Router) + TypeScript** | Static export for GH Pages demo; server actions for secret-handling in prod. |
| Styling | **Tailwind CSS + shadcn/ui** | Fast iteration, no design debt; Radix primitives are accessible. |
| Data fetch | **TanStack Query (react-query)** | First-class polling + cache invalidation + optimistic updates. |
| Charts | **Recharts** for tables, **Plotly.js-basic** for Manhattan plot | Covers the two viz shapes we need. |
| API contracts | **OpenAPI 3.1 + `openapi-typescript`** | Types generated from coordinator spec; no hand-rolled DTOs. |
| Coordinator | **Python 3.12 + FastAPI** | Matches the `generate-shards.py` stack; Pydantic gives the same typed contracts. |
| Storage | **SQLite (Hub) / per-site PostgreSQL (Federated)** | SQLite is zero-ops for the demo; PG for real deployments. |
| Relay (Federated only) | **NATS JetStream** | Lightweight pub-sub with replay; small dependency footprint vs Kafka. |

## 6. Data model (TypeScript)

```ts
// site-coordinator API contract (shared with dashboard)
type SiteId = string; // opaque

type RunState =
  | "pending" | "running" | "succeeded" | "failed" | "cancelled";

interface InvariantCheck {
  name: string;         // "counts_columns", "pooled_columns", "no_sample_ids"
  expected: string;     // e.g. "6"
  observed: string;     // e.g. "6"
  passed: boolean;
}

interface SiteRun {
  runId: string;
  siteId: SiteId;
  pipelineRef: string;  // git commit + filename
  shardRef: string;     // opaque handle — never a filesystem path
  state: RunState;
  startedAt: string;    // RFC3339
  finishedAt?: string;
  tasks: Array<{
    name: string;
    bacalhauJobId?: string;
    state: "submitted" | "running" | "completed" | "failed";
  }>;
  invariant: {
    ok: boolean;
    checks: InvariantCheck[];
  };
}

interface FederationRun {
  federationRunId: string;
  sites: Array<{
    siteId: SiteId;
    run: SiteRun | null;   // null until the site joins
  }>;
  aggregator: {
    state: RunState;
    bacalhauJobId?: string;
    resultDigest?: string;  // sha256 of pooled_af.tsv
  };
  overallInvariant: {
    ok: boolean;
    failedSites: SiteId[];
  };
}
```

No field in any of these types carries per-patient data. The dashboard
cannot accidentally render a genotype because the schema forbids it.

## 7. Privacy model

1. **Schema-level**: the coordinator API never returns anything that could
   contain genotypes. The `counts.tsv` endpoint is the *only* data-bearing
   endpoint and returns a 6-column aggregate file.
2. **Runtime check**: the coordinator re-runs the same column-count and
   sample-ID regex check the demo's `run.sh` performs. If the local
   invariant fails, the `/counts` endpoint returns `409 Conflict` with the
   failed check — the aggregator cannot pull the file.
3. **Audit trail**: every `/counts` fetch is logged at both ends with the
   file digest so a post-hoc auditor can verify that the aggregate
   returned was unchanged.
4. **Token scope**: site tokens are read-scoped; only a site-local
   operator token can `POST /v1/runs`. The aggregator has no write
   capability on any site.

## 8. UI wireframes (text-only)

**Home — `/`:**

```
┌──────────────────────────────────────────────────────────────┐
│ Federated AF Dashboard                    [New run] [⚙]      │
├──────────────────────────────────────────────────────────────┤
│ Federation run  fr-42  ·  started 14:03  ·  2m elapsed       │
│ [OK] Invariant holds across 3/3 sites                        │
│                                                              │
│ Site         Node        Shard        Run        State       │
│ ── Site A ── bac://A …   siteA.vcf    r-12       ✓ completed │
│ ── Site B ── bac://B …   siteB.vcf    r-13       ⟳ running   │
│ ── Site C ── bac://C …   siteC.vcf    r-14       ✓ completed │
│                                                              │
│ Aggregator                             agg-7     ⟳ pending   │
└──────────────────────────────────────────────────────────────┘
```

**Run detail — `/runs/fr-42`:** waterfall chart of per-site task
timelines, aggregator task below, pooled-AF table + Manhattan plot when
the aggregator finishes.

**Site detail — `/sites/A`:** Bacalhau health card, nextflow.config viewer
(read-only), last-10-runs table, local invariant panel.

## 9. Milestones

| M | Scope | Demo-deliverable |
|---|---|---|
| **M0** | Spec (this doc) | — |
| **M1** | Next.js scaffold + Home page reading Bacalhau REST directly (Hub mode) | Home page shows our local node's 4-job federated-AF run with live status. |
| **M2** | Run-detail page with waterfall + pooled-AF table viewer | Opening `/runs/fr-42` shows the 201-row pooled AF and a Manhattan plot. |
| **M3** | `site-coordinator` v1 (FastAPI) with `/runs`, `/status`, `/counts`, `/healthz` | Dashboard talks to a coordinator instead of Bacalhau directly; invariant is computed server-side. |
| **M4** | Settings page + multi-site config + token storage | A fresh install can be pointed at 3 running coordinators and works end-to-end. |
| **M5** | Federated-mode relay (NATS) + audit log | Three independently-deployed dashboards see the same federation run without any site polling another site's Bacalhau directly. |

**MVP = M1 + M2.** That's the smallest useful thing and the one to ship
alongside the applications note. M3–M5 are the follow-on research work.

## 10. Open questions

- **Auth model.** Start with static per-site bearer tokens stored in
  `.env.local`. Upgrade to OIDC (Keycloak) when a real institution asks.
- **Pipeline versioning.** Do we pin the federation to a specific
  `main.nf` git SHA, or let each site run its own pinned copy and rely on
  invariant checks to catch drift? Probably the latter — matches how
  real consortia work.
- **Relay choice.** NATS vs NKN vs a boring Postgres `LISTEN/NOTIFY`.
  Decide at M5.
- **Manhattan plot performance.** 200 variants is fine with Plotly; at
  100k variants we'll need WebGL. Out of scope for MVP.
- **Resume semantics.** If Site B's run fails mid-federation, can the
  aggregator re-request after Site B restarts? Probably yes via
  `runId` idempotency. Design at M3.

## 11. What this unlocks for the manuscript

- A figure: the federation-mode topology diagram above becomes Figure 3.
- A screenshot: the Home page during a live run with the invariant banner
  green becomes Figure 4 — a concrete, inspectable artifact of the
  privacy guarantee.
- A discussion paragraph: the Federated mode is a novel *coordination*
  contribution on top of Bacalhau's *execution* contribution; the demo
  proves both layers compose.

## 12. Next action

Build M1 in a new branch (`feat/federation-dashboard-mvp`). Scaffold with
`create-next-app`, wire TanStack Query to the Bacalhau REST API at
`http://localhost:1234/api/v1/orchestrator/jobs`, render a grid of our
local node's jobs. Target: a screenshot-worthy Home page by end of the
next session.

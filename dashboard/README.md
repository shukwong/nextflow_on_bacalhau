# Federation Dashboard (M1 MVP)

A lightweight web dashboard for the **nf-bacalhau** federated allele-frequency
demo. M1 watches a **single local Bacalhau node** and shows the jobs submitted
by the federated-AF workflow in real time.

See [`design/federation-dashboard.md`](../design/federation-dashboard.md) for
the full multi-milestone plan (Hub + Federated modes, coordinator API, NATS).

## Quick start

Prerequisites:
- Node.js >= 18.17
- A running local Bacalhau node (`bacalhau serve --node-type=requester,compute`)

```bash
cd dashboard
npm install
npm run dev
# → http://localhost:3000
```

By default the app assumes Bacalhau's REST API at
`http://localhost:1234`. Override with:

```bash
BACALHAU_API_URL=http://my-node:1234 npm run dev
```

## Scripts

```bash
npm run dev        # Dev server on :3000
npm run build      # Production build (standalone output)
npm run start      # Run the built bundle
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
```

## Architecture (M1)

```
Browser  ──▶  Next.js (this app)  ──▶  /api/bacalhau/*  ──▶  Bacalhau node
                     ▲                 (server proxy)         :1234
                     └── TanStack Query polls every 2 s ───────┘
```

The server-side proxy at `src/app/api/bacalhau/[...path]/route.ts` avoids CORS
issues and lets us one day add auth without touching the client.

## File map

- `src/app/page.tsx` — Home page (jobs table + node health + invariant banner)
- `src/hooks/use-bacalhau.ts` — Polling hooks (jobs list, node health)
- `src/lib/types.ts` — Bacalhau REST + federation types (privacy-safe)
- `src/components/` — `jobs-table`, `state-badge`, `invariant-banner`, `node-health-card`

## Privacy

The dashboard never displays or stores genotype data. Types in
`src/lib/types.ts` structurally forbid such fields. See the design doc for the
`InvariantCheck` contract that enforces this end-to-end.

## Status

**M1 (this scaffold):** local-node monitor. Ships with the applications note.
**M2:** run-detail view with pooled-AF viewer + waterfall timeline.
**M3–M5:** coordinator API, multi-site Hub mode, Federated mode via NATS.

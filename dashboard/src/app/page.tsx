'use client';

import Link from 'next/link';
import { Activity, AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { useAllSiteHealth, useAllSiteRuns } from '@/hooks/use-coordinator';
import { useSites } from '@/lib/sites-context';
import type {
  CoordinatorProbe,
  CoordinatorRunList,
  CoordinatorSiteRun,
} from '@/lib/coordinator-types';
import type { SiteConfig } from '@/lib/sites-storage';
import { cn } from '@/lib/utils';
import { StateBadge } from '@/components/state-badge';

export default function HomePage() {
  const { sites, hydrated } = useSites();
  const healthQueries = useAllSiteHealth(sites);
  const runsQueries = useAllSiteRuns(sites, { limit: 20 });

  const anyFetching = runsQueries.some((q) => q.isFetching);

  const federationRuns = useMemo(
    () => flattenRuns(sites, runsQueries.map((q) => q.data)),
    [sites, runsQueries],
  );

  if (!hydrated) {
    return (
      <Shell>
        <p className="text-sm text-slate-500">Loading…</p>
      </Shell>
    );
  }

  if (sites.length === 0) {
    return <EmptyState />;
  }

  const reachable = healthQueries.filter((q) => q.data?.ok).length;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">
            Federation Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {sites.length} site{sites.length === 1 ? '' : 's'} configured ·{' '}
            {reachable} reachable
          </p>
        </div>
        <div
          className={cn(
            'inline-flex items-center gap-2 text-xs',
            anyFetching ? 'text-state-info' : 'text-slate-500',
          )}
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', anyFetching && 'animate-spin')}
          />
          {anyFetching ? 'Polling…' : 'Live (5 s)'}
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {sites.map((site, idx) => (
          <SiteHealthCard
            key={site.id}
            site={site}
            probe={healthQueries[idx]?.data}
            isLoading={healthQueries[idx]?.isLoading ?? false}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Activity className="h-4 w-4 text-accent" />
          <h2 className="font-medium">Runs across all sites</h2>
        </div>
        <RunsTable runs={federationRuns} />
      </section>

      <footer className="pt-6 text-center text-xs text-slate-500">
        M4 · federated run view ·{' '}
        <Link className="underline decoration-dotted hover:text-slate-300" href="/settings">
          manage sites
        </Link>
      </footer>
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      {children}
    </main>
  );
}

function EmptyState() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 py-16 text-center">
      <div className="rounded-full bg-accent/10 p-3 text-accent">
        <Plus className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-semibold tracking-tight text-slate-100">
        Register your first site coordinator
      </h1>
      <p className="max-w-lg text-sm text-slate-400">
        The dashboard talks to one or more site-coordinator HTTP APIs, one per
        institution. Add a coordinator URL (and optional operator token) to see
        live runs, invariant status, and counts.tsv handoffs.
      </p>
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-slate-900 hover:bg-accent/90"
      >
        <Plus className="h-4 w-4" />
        Add site
      </Link>
      <p className="text-xs text-slate-500">
        Tokens live only in this browser&apos;s local storage. See the design
        doc &sect;10 for the trade-off.
      </p>
    </main>
  );
}

function SiteHealthCard({
  site,
  probe,
  isLoading,
}: {
  site: SiteConfig;
  probe: CoordinatorProbe | undefined;
  isLoading: boolean;
}) {
  const tone = !probe || isLoading ? 'idle' : probe.ok ? 'ok' : 'err';
  const detail = isLoading
    ? 'checking…'
    : probe?.ok
      ? `v${probe.health?.version} · bacalhau ${probe.health?.bacalhau_reachable ? 'ok' : 'down'}`
      : (probe?.error ?? 'unreachable');

  return (
    <div className="rounded-lg border border-white/5 bg-surface-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-100">{site.label}</p>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset',
            tone === 'ok' && 'bg-state-ok/15 text-state-ok ring-state-ok/30',
            tone === 'err' &&
              'bg-state-err/15 text-state-err ring-state-err/30',
            tone === 'idle' &&
              'bg-state-idle/15 text-slate-400 ring-state-idle/30',
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {tone === 'ok' ? 'ok' : tone === 'err' ? 'unreachable' : 'checking'}
        </span>
      </div>
      <p className="mt-1 font-mono text-xs text-slate-500">
        {site.coordinatorUrl}
      </p>
      <p className="mt-2 text-xs text-slate-400">
        {probe?.health?.site_id ? `site_id: ${probe.health.site_id}` : detail}
      </p>
      {tone === 'err' && (
        <p className="mt-1 flex items-start gap-1 text-xs text-state-err">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="break-words">{detail}</span>
        </p>
      )}
    </div>
  );
}

interface FederationRunRow {
  siteId: string;
  siteLabel: string;
  run: CoordinatorSiteRun;
}

function flattenRuns(
  sites: SiteConfig[],
  lists: (CoordinatorRunList | undefined)[],
): FederationRunRow[] {
  const rows: FederationRunRow[] = [];
  sites.forEach((site, idx) => {
    const list = lists[idx];
    if (!list) return;
    for (const run of list.runs) {
      rows.push({ siteId: site.id, siteLabel: site.label, run });
    }
  });
  rows.sort(
    (a, b) =>
      new Date(b.run.started_at).getTime() -
      new Date(a.run.started_at).getTime(),
  );
  return rows;
}

function RunsTable({ runs }: { runs: FederationRunRow[] }) {
  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-white/5 bg-surface-card p-6 text-center text-sm text-slate-500">
        No runs reported across configured sites yet.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-white/5 bg-surface-card">
      <table className="min-w-full text-sm">
        <thead className="bg-surface-muted/40 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left">Site</th>
            <th className="px-4 py-2 text-left">Run</th>
            <th className="px-4 py-2 text-left">Pipeline · shard</th>
            <th className="px-4 py-2 text-left">State</th>
            <th className="px-4 py-2 text-left">Started</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(({ siteId, siteLabel, run }) => (
            <tr
              key={`${siteId}:${run.run_id}`}
              className="border-t border-white/5 hover:bg-white/2"
            >
              <td className="px-4 py-2 text-xs text-slate-300">{siteLabel}</td>
              <td className="px-4 py-2">
                <Link
                  href={`/sites/${siteId}/runs/${run.run_id}`}
                  className="font-mono text-xs text-accent hover:underline"
                >
                  {run.run_id.slice(0, 12)}…
                </Link>
              </td>
              <td className="px-4 py-2 text-xs text-slate-400">
                {run.pipeline_ref} · {run.shard_ref}
              </td>
              <td className="px-4 py-2">
                <StateBadge state={capitalize(run.state)} />
              </td>
              <td className="px-4 py-2 text-xs text-slate-500">
                {new Date(run.started_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

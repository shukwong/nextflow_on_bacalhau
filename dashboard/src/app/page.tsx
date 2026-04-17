'use client';

import { Activity, RefreshCw } from 'lucide-react';
import { InvariantBanner } from '@/components/invariant-banner';
import { JobsTable } from '@/components/jobs-table';
import { NodeHealthCard } from '@/components/node-health-card';
import { useBacalhauJobs, useBacalhauNode } from '@/hooks/use-bacalhau';
import type { InvariantCheck } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATIC_INVARIANTS: InvariantCheck[] = [
  {
    name: 'no-genotypes-in-output',
    ok: true,
    detail: 'Output schema restricted to CHROM/POS/REF/ALT/AC/AN/AF',
  },
  {
    name: 'counts-only',
    ok: true,
    detail: 'bcftools +fill-tags -t AN,AC emits integer counts only',
  },
];

export default function HomePage() {
  const node = useBacalhauNode();
  const { jobs, isLoading, error, isFetching } = useBacalhauJobs();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">
            Federation Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Local Bacalhau node · federated allele-frequency runs
          </p>
        </div>
        <div
          className={cn(
            'inline-flex items-center gap-2 text-xs',
            isFetching ? 'text-state-info' : 'text-slate-500',
          )}
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')}
          />
          {isFetching ? 'Polling…' : 'Live (2 s)'}
        </div>
      </header>

      <InvariantBanner checks={STATIC_INVARIANTS} />

      <section className="grid gap-4 md:grid-cols-3">
        <NodeHealthCard
          node={node.data?.NodeInfo}
          error={(node.error as Error | null) ?? null}
          isLoading={node.isLoading}
        />
        <StatCard label="Jobs visible" value={String(jobs.length)} />
        <StatCard
          label="Running"
          value={String(
            jobs.filter((j) => j.State?.StateType === 'Running').length,
          )}
          accent="info"
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Activity className="h-4 w-4 text-accent" />
          <h2 className="font-medium">Jobs</h2>
        </div>
        {error ? (
          <div className="rounded-lg border border-state-err/30 bg-state-err/10 p-4 text-sm text-state-err">
            {error.message}
          </div>
        ) : (
          <JobsTable jobs={jobs} isLoading={isLoading} />
        )}
      </section>

      <footer className="pt-6 text-center text-xs text-slate-500">
        M1 MVP · reads read-only · see{' '}
        <a
          className="underline decoration-dotted hover:text-slate-300"
          href="https://github.com/shukwong/nextflow_on_bacalhau/blob/main/design/federation-dashboard.md"
        >
          design doc
        </a>{' '}
        for the multi-site roadmap.
      </footer>
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'info' | 'ok' | 'warn';
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-surface-card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-2 text-2xl font-semibold',
          accent === 'info' && 'text-state-info',
          accent === 'ok' && 'text-state-ok',
          accent === 'warn' && 'text-state-warn',
          !accent && 'text-slate-100',
        )}
      >
        {value}
      </p>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, XCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelRun, getCountsUrl } from '@/lib/coordinator';
import { useSiteRun } from '@/hooks/use-coordinator';
import { useSites } from '@/lib/sites-context';
import type { CoordinatorSiteRun } from '@/lib/coordinator-types';

export default function RunDetailPage() {
  const params = useParams<{ siteId: string; runId: string }>();
  const siteId = params?.siteId;
  const runId = params?.runId;
  const { getSite, hydrated } = useSites();
  const site = siteId ? getSite(siteId) : undefined;
  const queryClient = useQueryClient();

  const runQuery = useSiteRun(site, runId);

  const cancelMutation = useMutation({
    mutationFn: () => cancelRun(site!, runId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coord', site?.id, 'run', runId] });
    },
  });

  if (!hydrated) {
    return <Shell>Loading…</Shell>;
  }
  if (!site) {
    return (
      <Shell>
        <p className="text-sm text-state-err">
          No site with id <code>{siteId}</code> is configured.
        </p>
        <Link href="/settings" className="text-xs text-accent underline">
          Configure sites →
        </Link>
      </Shell>
    );
  }
  if (runQuery.isLoading) return <Shell>Loading run…</Shell>;
  if (runQuery.error) {
    return (
      <Shell>
        <p className="text-sm text-state-err">{(runQuery.error as Error).message}</p>
      </Shell>
    );
  }

  const run = runQuery.data;
  if (!run) return <Shell>Run not found.</Shell>;

  const terminal = run.state === 'succeeded' || run.state === 'failed' || run.state === 'cancelled';
  const countsUrl = run.state === 'succeeded' ? `${site.coordinatorUrl}/v1/counts/${run.run_id}` : null;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to federation view
      </Link>

      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {site.label}
          </p>
          <h1 className="mt-1 font-mono text-lg text-slate-100">{run.run_id}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {run.pipeline_ref} · shard {run.shard_ref}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {countsUrl && (
            <a
              href={countsUrl}
              className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-3 py-1.5 text-xs text-accent ring-1 ring-inset ring-accent/30 hover:bg-accent/25"
            >
              <Download className="h-3 w-3" />
              counts.tsv
            </a>
          )}
          {!terminal && (
            <button
              type="button"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="inline-flex items-center gap-1 rounded-md border border-state-err/30 px-3 py-1.5 text-xs text-state-err hover:bg-state-err/10 disabled:opacity-50"
            >
              <XCircle className="h-3 w-3" />
              {cancelMutation.isPending ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
        </div>
      </header>

      {cancelMutation.error && (
        <div className="rounded-md border border-state-err/30 bg-state-err/10 p-3 text-xs text-state-err">
          {(cancelMutation.error as Error).message}
        </div>
      )}

      <RunStateCard run={run} />
      <TasksCard run={run} />
      <InvariantCard run={run} />
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-10 text-sm text-slate-400">
      {children}
    </main>
  );
}

function RunStateCard({ run }: { run: CoordinatorSiteRun }) {
  return (
    <section className="grid gap-4 rounded-lg border border-white/5 bg-surface-card p-4 md:grid-cols-4">
      <Stat label="State" value={run.state} />
      <Stat label="Site" value={run.site_id} />
      <Stat label="Started" value={new Date(run.started_at).toLocaleString()} />
      <Stat
        label="Finished"
        value={run.finished_at ? new Date(run.finished_at).toLocaleString() : '—'}
      />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-100">{value}</p>
    </div>
  );
}

function TasksCard({ run }: { run: CoordinatorSiteRun }) {
  return (
    <section className="rounded-lg border border-white/5 bg-surface-card">
      <header className="border-b border-white/5 px-4 py-2 text-sm font-medium text-slate-200">
        Tasks
      </header>
      {run.tasks.length === 0 ? (
        <p className="px-4 py-4 text-xs text-slate-500">No tasks reported yet.</p>
      ) : (
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Task</th>
              <th className="px-4 py-2 text-left">Bacalhau job</th>
              <th className="px-4 py-2 text-left">State</th>
            </tr>
          </thead>
          <tbody>
            {run.tasks.map((task) => (
              <tr key={task.name} className="border-t border-white/5">
                <td className="px-4 py-2 text-slate-100">{task.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-slate-400">
                  {task.bacalhau_job_id ?? '—'}
                </td>
                <td className="px-4 py-2 text-xs text-slate-300">{task.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function InvariantCard({ run }: { run: CoordinatorSiteRun }) {
  if (!run.invariant) {
    return (
      <section className="rounded-lg border border-white/5 bg-surface-card p-4 text-xs text-slate-500">
        Invariant checks run only after counts.tsv is produced.
      </section>
    );
  }
  const ok = run.invariant.ok;
  return (
    <section
      className={
        'rounded-lg border p-4 ' +
        (ok
          ? 'border-state-ok/30 bg-state-ok/5'
          : 'border-state-err/30 bg-state-err/5')
      }
    >
      <h2 className={'text-sm font-medium ' + (ok ? 'text-state-ok' : 'text-state-err')}>
        {ok ? 'Privacy invariants passed' : 'Invariant failure — counts blocked'}
      </h2>
      <ul className="mt-2 space-y-1 text-xs text-slate-300">
        {run.invariant.checks.map((c) => (
          <li key={c.name}>
            <span className={c.passed ? 'text-state-ok' : 'text-state-err'}>
              {c.passed ? '✓' : '✗'}
            </span>{' '}
            <span className="font-medium text-slate-200">{c.name}</span>
            <span className="ml-2 text-slate-500">
              expected {c.expected}, observed {c.observed}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

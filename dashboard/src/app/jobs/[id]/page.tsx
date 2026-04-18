'use client';

import { ArrowLeft, Cpu, HardDrive, Hash, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ExecutionsTimeline } from '@/components/executions-timeline';
import { StateBadge } from '@/components/state-badge';
import { useJobDetail } from '@/hooks/use-job-detail';
import {
  cn,
  formatDuration,
  formatRelativeTime,
  formatTimeOfDay,
  toMilliseconds,
} from '@/lib/utils';

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id ?? '';
  const { job, executions, isLoading, isFetching, error } = useJobDetail(jobId);
  const primaryTask = job?.Tasks?.[0];

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to jobs
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-100">
            {job?.Name ?? 'Job detail'}
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">{jobId}</p>
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

      {error ? (
        <div className="rounded-lg border border-state-err/30 bg-state-err/10 p-4 text-sm text-state-err">
          {error.message}
        </div>
      ) : null}

      {isLoading && !job ? (
        <div className="rounded-lg border border-white/5 bg-surface-card p-6 text-sm text-slate-400">
          Loading job…
        </div>
      ) : null}

      {job ? (
        <section className="grid gap-4 md:grid-cols-3">
          <InfoCard label="State">
            <StateBadge state={job.State?.StateType} />
            {job.State?.Message ? (
              <p className="mt-2 text-xs text-slate-500">{job.State.Message}</p>
            ) : null}
          </InfoCard>
          <InfoCard label="Created">
            <p className="font-mono text-sm text-slate-200">
              {formatTimeOfDay(job.CreateTime)}
            </p>
            <p className="text-xs text-slate-500">
              {formatRelativeTime(job.CreateTime)}
            </p>
          </InfoCard>
          <InfoCard label="Duration">
            <p className="font-mono text-sm text-slate-200">
              {formatDuration(job.CreateTime, job.ModifyTime)}
            </p>
            <p className="text-xs text-slate-500">
              {job.CreateTime
                ? new Date(toMilliseconds(job.CreateTime)).toLocaleString()
                : '—'}
            </p>
          </InfoCard>
        </section>
      ) : null}

      {primaryTask ? (
        <section className="rounded-lg border border-white/5 bg-surface-card p-4">
          <h2 className="text-sm font-medium text-slate-200">Task</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-400 md:grid-cols-4">
            <TaskField
              icon={<Hash className="h-3 w-3" />}
              label="Engine"
              value={primaryTask.Engine?.Type ?? '—'}
            />
            <TaskField
              icon={<Cpu className="h-3 w-3" />}
              label="CPU"
              value={primaryTask.Resources?.CPU ?? '—'}
            />
            <TaskField
              icon={<HardDrive className="h-3 w-3" />}
              label="Memory"
              value={primaryTask.Resources?.Memory ?? '—'}
            />
            <TaskField
              icon={<HardDrive className="h-3 w-3" />}
              label="Disk"
              value={primaryTask.Resources?.Disk ?? '—'}
            />
          </dl>
          {typeof primaryTask.Engine?.Params === 'object' &&
          primaryTask.Engine?.Params &&
          'Image' in primaryTask.Engine.Params ? (
            <p className="mt-3 font-mono text-xs text-slate-400">
              image:{' '}
              <span className="text-slate-200">
                {String(
                  (primaryTask.Engine.Params as Record<string, unknown>)['Image'] ??
                    '',
                )}
              </span>
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-slate-200">Executions</h2>
        <ExecutionsTimeline
          executions={executions}
          jobCreateTime={job?.CreateTime}
          jobModifyTime={job?.ModifyTime}
        />
      </section>

      <footer className="pt-6 text-center text-xs text-slate-500">
        Bacalhau REST · read-only · detail polling every 2 s.
      </footer>
    </main>
  );
}

function InfoCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-surface-card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function TaskField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-slate-500">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-sm text-slate-200">{value}</dd>
    </div>
  );
}

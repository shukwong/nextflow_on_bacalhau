'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { BacalhauJobSummary } from '@/lib/types';
import {
  cn,
  durationSeconds,
  formatDuration,
  formatTimeOfDay,
  toMilliseconds,
} from '@/lib/utils';
import { StateBadge } from './state-badge';

interface JobsTableProps {
  jobs: BacalhauJobSummary[];
  isLoading: boolean;
}

type SortKey = 'state' | 'created' | 'duration';
type SortDir = 'asc' | 'desc';

const STATE_ORDER: Record<string, number> = {
  Running: 0,
  Pending: 1,
  Queued: 2,
  Completed: 3,
  Failed: 4,
  Cancelled: 5,
  Stopped: 6,
  Unknown: 7,
};

function compareJobs(
  a: BacalhauJobSummary,
  b: BacalhauJobSummary,
  key: SortKey,
): number {
  if (key === 'state') {
    const aw = STATE_ORDER[a.State?.StateType ?? 'Unknown'] ?? 99;
    const bw = STATE_ORDER[b.State?.StateType ?? 'Unknown'] ?? 99;
    return aw - bw;
  }
  if (key === 'created') {
    return (a.CreateTime ?? 0) - (b.CreateTime ?? 0);
  }
  // duration
  return (
    durationSeconds(a.CreateTime, a.ModifyTime) -
    durationSeconds(b.CreateTime, b.ModifyTime)
  );
}

export function JobsTable({ jobs, isLoading }: JobsTableProps) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? jobs.filter((j) =>
          (j.Name ?? '').toLowerCase().includes(q) ||
          j.ID.toLowerCase().includes(q),
        )
      : jobs;
    const sorted = [...filtered].sort((a, b) => compareJobs(a, b, sortKey));
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [jobs, query, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'state' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search job name or ID…"
          className="w-full rounded-lg border border-white/10 bg-surface-card py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {isLoading && jobs.length === 0 ? (
        <div className="rounded-lg border border-white/5 bg-surface-card p-6 text-sm text-slate-400">
          Loading jobs…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-white/5 bg-surface-card p-6 text-sm text-slate-400">
          {query
            ? `No jobs match "${query}".`
            : 'No jobs on this node yet. Submit a run with '}
          {!query && (
            <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-xs">
              nextflow run examples/federated-af
            </code>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/5 bg-surface-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <SortHeader
                  label="State"
                  active={sortKey === 'state'}
                  dir={sortDir}
                  onClick={() => toggleSort('state')}
                />
                <SortHeader
                  label="Created"
                  active={sortKey === 'created'}
                  dir={sortDir}
                  onClick={() => toggleSort('created')}
                />
                <SortHeader
                  label="Duration"
                  active={sortKey === 'duration'}
                  dir={sortDir}
                  onClick={() => toggleSort('duration')}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {visible.map((job) => (
                <tr key={job.ID} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      href={`/jobs/${job.ID}`}
                      className="text-accent hover:underline"
                    >
                      {job.ID.slice(0, 12)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-200">
                    {job.Name ?? <span className="text-slate-500">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StateBadge state={job.State?.StateType} />
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-xs text-slate-400"
                    title={
                      job.CreateTime
                        ? new Date(toMilliseconds(job.CreateTime)).toLocaleString()
                        : undefined
                    }
                  >
                    {formatTimeOfDay(job.CreateTime)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    {formatDuration(job.CreateTime, job.ModifyTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Showing {visible.length} of {jobs.length} job{jobs.length === 1 ? '' : 's'}
      </p>
    </div>
  );
}

interface SortHeaderProps {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}

function SortHeader({ label, active, dir, onClick }: SortHeaderProps) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className="px-4 py-3 font-medium">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-slate-200',
          active && 'text-slate-100',
        )}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

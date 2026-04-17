import type { BacalhauJobSummary } from '@/lib/types';
import { formatDuration, formatRelativeTime } from '@/lib/utils';
import { StateBadge } from './state-badge';

interface JobsTableProps {
  jobs: BacalhauJobSummary[];
  isLoading: boolean;
}

export function JobsTable({ jobs, isLoading }: JobsTableProps) {
  if (isLoading && jobs.length === 0) {
    return (
      <div className="rounded-lg border border-white/5 bg-surface-card p-6 text-sm text-slate-400">
        Loading jobs…
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-white/5 bg-surface-card p-6 text-sm text-slate-400">
        No jobs on this node yet. Submit a run with{' '}
        <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-xs">
          nextflow run examples/federated-af
        </code>
        .
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/5 bg-surface-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">Job</th>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">State</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 font-medium">Duration</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {jobs.map((job) => (
            <tr key={job.ID} className="hover:bg-white/[0.02]">
              <td className="px-4 py-3 font-mono text-xs text-slate-300">
                {job.ID.slice(0, 12)}
              </td>
              <td className="px-4 py-3 text-slate-200">
                {job.Name ?? <span className="text-slate-500">—</span>}
              </td>
              <td className="px-4 py-3">
                <StateBadge state={job.State?.StateType} />
              </td>
              <td className="px-4 py-3 text-slate-400">
                {formatRelativeTime(job.CreateTime)}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-400">
                {formatDuration(job.CreateTime, job.ModifyTime)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

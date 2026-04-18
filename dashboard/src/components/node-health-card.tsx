import type { BacalhauNodeInfo } from '@/lib/types';
import { cn } from '@/lib/utils';

interface NodeHealthCardProps {
  node?: BacalhauNodeInfo;
  error: Error | null;
  isLoading: boolean;
}

export function NodeHealthCard({ node, error, isLoading }: NodeHealthCardProps) {
  const healthy = !error && !!node;
  const statusText = error
    ? 'Unreachable'
    : isLoading && !node
      ? 'Connecting…'
      : 'Healthy';

  return (
    <div className="rounded-lg border border-white/5 bg-surface-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              healthy ? 'bg-state-ok' : error ? 'bg-state-err' : 'bg-state-idle',
            )}
          />
          <h3 className="text-sm font-medium text-slate-200">
            Local Bacalhau node
          </h3>
        </div>
        <span
          className={cn(
            'text-xs font-medium',
            healthy
              ? 'text-state-ok'
              : error
                ? 'text-state-err'
                : 'text-slate-400',
          )}
        >
          {statusText}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-slate-500">Node ID</dt>
          <dd className="truncate font-mono text-slate-300" title={node?.NodeID}>
            {node?.NodeID ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Version</dt>
          <dd className="font-mono text-slate-300">
            {node?.BacalhauVersion?.GitVersion ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Type</dt>
          <dd className="text-slate-300">{node?.NodeType ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Protocols</dt>
          <dd className="text-slate-300">
            {node?.SupportedProtocols?.join(', ') ?? '—'}
          </dd>
        </div>
      </dl>
      {error ? (
        <p className="mt-3 rounded bg-state-err/10 px-3 py-2 text-xs text-state-err ring-1 ring-state-err/20">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

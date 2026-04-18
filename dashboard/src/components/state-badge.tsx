import { cn } from '@/lib/utils';

const STATE_STYLES: Record<string, string> = {
  Completed: 'bg-state-ok/15 text-state-ok ring-state-ok/30',
  Running: 'bg-state-info/15 text-state-info ring-state-info/30',
  Queued: 'bg-state-idle/15 text-slate-300 ring-state-idle/30',
  Pending: 'bg-state-idle/15 text-slate-300 ring-state-idle/30',
  Failed: 'bg-state-err/15 text-state-err ring-state-err/30',
  Cancelled: 'bg-state-warn/15 text-state-warn ring-state-warn/30',
  Stopped: 'bg-state-warn/15 text-state-warn ring-state-warn/30',
  Unknown: 'bg-state-idle/15 text-slate-400 ring-state-idle/30',
};

export function StateBadge({ state }: { state?: string }) {
  const label = state ?? 'Unknown';
  const style = STATE_STYLES[label] ?? STATE_STYLES.Unknown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        style,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

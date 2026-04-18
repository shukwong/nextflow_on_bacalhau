'use client';

import type { BacalhauExecution } from '@/lib/types';
import { cn, formatDuration, formatTimeOfDay, toMilliseconds } from '@/lib/utils';

interface ExecutionsTimelineProps {
  executions: BacalhauExecution[];
  jobCreateTime?: number;
  jobModifyTime?: number;
}

const STATE_FILL: Record<string, string> = {
  BidAccepted: 'fill-state-info',
  AskForBid: 'fill-state-idle',
  Completed: 'fill-state-ok',
  Running: 'fill-state-info',
  Failed: 'fill-state-err',
  Cancelled: 'fill-state-warn',
  Stopped: 'fill-state-warn',
};

function stateFill(state?: string): string {
  return STATE_FILL[state ?? 'Unknown'] ?? 'fill-state-idle';
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

export function ExecutionsTimeline({
  executions,
  jobCreateTime,
  jobModifyTime,
}: ExecutionsTimelineProps) {
  if (executions.length === 0) {
    return (
      <div className="rounded-lg border border-white/5 bg-surface-card p-6 text-sm text-slate-400">
        No executions reported yet for this job.
      </div>
    );
  }

  const startMs = Math.min(
    ...executions
      .map((e) => (e.CreateTime ? toMilliseconds(e.CreateTime) : Number.POSITIVE_INFINITY))
      .concat(jobCreateTime ? [toMilliseconds(jobCreateTime)] : []),
  );
  const endMs = Math.max(
    ...executions
      .map((e) =>
        e.ModifyTime ? toMilliseconds(e.ModifyTime) : Date.now(),
      )
      .concat(jobModifyTime ? [toMilliseconds(jobModifyTime)] : []),
  );
  const span = Math.max(1, endMs - startMs);

  const rowHeight = 28;
  const rowGap = 8;
  const width = 720;
  const leftGutter = 140;
  const rightGutter = 60;
  const barArea = width - leftGutter - rightGutter;
  const height = executions.length * (rowHeight + rowGap) + 16;

  return (
    <div className="rounded-lg border border-white/5 bg-surface-card p-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Execution waterfall"
        className="w-full"
      >
        {executions.map((exec, i) => {
          const cMs = exec.CreateTime
            ? toMilliseconds(exec.CreateTime)
            : startMs;
          const mMs = exec.ModifyTime ? toMilliseconds(exec.ModifyTime) : endMs;
          const x = leftGutter + ((cMs - startMs) / span) * barArea;
          const w = Math.max(2, ((mMs - cMs) / span) * barArea);
          const y = 8 + i * (rowHeight + rowGap);
          return (
            <g key={exec.ID}>
              <text
                x={leftGutter - 8}
                y={y + rowHeight / 2 + 4}
                textAnchor="end"
                className="fill-slate-400 font-mono text-[11px]"
              >
                {shortId(exec.ID)}
              </text>
              <rect
                x={leftGutter}
                y={y}
                width={barArea}
                height={rowHeight}
                className="fill-white/[0.02]"
                rx={4}
              />
              <rect
                x={x}
                y={y + 4}
                width={w}
                height={rowHeight - 8}
                className={cn(
                  stateFill(exec.ComputeState?.StateType),
                  'opacity-90',
                )}
                rx={3}
              >
                <title>
                  {shortId(exec.ID)} · {exec.ComputeState?.StateType ?? 'Unknown'}
                  {'\n'}start: {formatTimeOfDay(exec.CreateTime)}
                  {'\n'}end: {formatTimeOfDay(exec.ModifyTime)}
                  {'\n'}dur: {formatDuration(exec.CreateTime, exec.ModifyTime)}
                </title>
              </rect>
              <text
                x={Math.min(x + w + 6, width - rightGutter + 4)}
                y={y + rowHeight / 2 + 4}
                className="fill-slate-400 font-mono text-[10px]"
              >
                {formatDuration(exec.CreateTime, exec.ModifyTime)}
              </text>
            </g>
          );
        })}
        <line
          x1={leftGutter}
          y1={height - 4}
          x2={width - rightGutter}
          y2={height - 4}
          className="stroke-white/10"
          strokeWidth={1}
        />
        <text
          x={leftGutter}
          y={height + 12}
          className="fill-slate-500 text-[10px]"
        >
          {formatTimeOfDay(startMs)}
        </text>
        <text
          x={width - rightGutter}
          y={height + 12}
          textAnchor="end"
          className="fill-slate-500 text-[10px]"
        >
          {formatTimeOfDay(endMs)}
        </text>
      </svg>
      <ul className="mt-4 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
        {executions.map((exec) => (
          <li
            key={exec.ID}
            className="flex items-center justify-between gap-3 rounded bg-white/[0.02] px-3 py-2"
          >
            <span className="font-mono text-slate-300">{shortId(exec.ID)}</span>
            <span>
              <span className="text-slate-500">compute:</span>{' '}
              {exec.ComputeState?.StateType ?? '—'}
            </span>
            <span>
              <span className="text-slate-500">desired:</span>{' '}
              {exec.DesiredState?.StateType ?? '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

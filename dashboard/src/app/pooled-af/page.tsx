'use client';

import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { ManhattanPlot } from '@/components/manhattan-plot';
import { PooledAFLoader } from '@/components/pooled-af-loader';
import { PooledAFTable } from '@/components/pooled-af-table';
import type { InvariantCheck, PooledAFParseResult } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function PooledAFPage() {
  const [result, setResult] = useState<PooledAFParseResult | null>(null);
  const [yAxis, setYAxis] = useState<'af' | 'ac'>('af');

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-slate-100">
          Pooled allele-frequency viewer
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Aggregate-only. The parser rejects any file that carries sample IDs or
          genotype columns. Files are processed locally in your browser —
          nothing leaves this page.
        </p>
      </header>

      <PooledAFLoader
        fileName={result?.fileName ?? null}
        onLoad={(r) => setResult(r)}
      />

      {result ? <InvariantPanel checks={result.invariants} /> : null}

      {result && result.errors.length > 0 ? (
        <div className="rounded-lg border border-state-err/30 bg-state-err/10 p-4 text-sm text-state-err">
          <p className="font-medium">File rejected</p>
          <ul className="mt-2 list-disc pl-5 text-xs">
            {result.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result && result.variants.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-200">
              Manhattan plot
              <span className="ml-2 text-xs text-slate-500">
                ({result.variants.length} variants from {result.fileName})
              </span>
            </h2>
            <div className="inline-flex overflow-hidden rounded-md border border-white/10 text-xs">
              <AxisToggle
                active={yAxis === 'af'}
                onClick={() => setYAxis('af')}
              >
                AF
              </AxisToggle>
              <AxisToggle
                active={yAxis === 'ac'}
                onClick={() => setYAxis('ac')}
              >
                AC
              </AxisToggle>
            </div>
          </div>
          <ManhattanPlot variants={result.variants} yAxis={yAxis} />
          <h2 className="text-sm font-medium text-slate-200">Variants</h2>
          <PooledAFTable variants={result.variants} />
        </>
      ) : null}

      {!result ? (
        <div className="rounded-lg border border-dashed border-white/10 bg-surface-card p-8 text-center text-sm text-slate-400">
          <p>
            Run the federated-AF demo (
            <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-xs">
              examples/federated-af/run.sh
            </code>
            ) to produce{' '}
            <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-xs">
              pooled_af.tsv
            </code>
            , then load it above.
          </p>
        </div>
      ) : null}

      <footer className="pt-6 text-center text-xs text-slate-500">
        Privacy invariant enforced at parse time. See{' '}
        <a
          className="underline decoration-dotted hover:text-slate-300"
          href="https://github.com/shukwong/nextflow_on_bacalhau/blob/main/design/federation-dashboard.md"
        >
          design doc §6
        </a>
        .
      </footer>
    </main>
  );
}

function InvariantPanel({ checks }: { checks: InvariantCheck[] }) {
  const allOk = checks.every((c) => c.ok);
  const Icon = allOk ? CheckCircle2 : ShieldAlert;
  return (
    <div
      className={cn(
        'rounded-lg px-4 py-3 ring-1 ring-inset',
        allOk
          ? 'bg-state-ok/10 ring-state-ok/30 text-state-ok'
          : 'bg-state-warn/10 ring-state-warn/30 text-state-warn',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <p className="text-sm font-medium">
          {allOk ? 'Privacy invariant holds' : 'Invariant failed — file not loaded'}
        </p>
      </div>
      <ul className="mt-2 grid gap-1 text-xs opacity-90 md:grid-cols-2">
        {checks.map((c) => (
          <li key={c.name} className="flex items-start gap-2">
            <span className={c.ok ? 'text-state-ok' : 'text-state-err'}>
              {c.ok ? '✓' : '✗'}
            </span>
            <span className="flex-1">
              <span className="font-mono text-[11px]">{c.name}</span>
              {c.detail ? (
                <span className="ml-1 text-slate-400">· {c.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AxisToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1 transition-colors',
        active
          ? 'bg-accent text-white'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
      )}
    >
      {children}
    </button>
  );
}

'use client';

import { useMemo } from 'react';
import type { PooledAFVariant } from '@/lib/types';
import { chromOrdinal } from '@/lib/pooled-af';

interface ManhattanPlotProps {
  variants: PooledAFVariant[];
  yAxis?: 'af' | 'ac';
}

const CHROM_COLORS = ['#6366f1', '#22d3ee']; // accent alternating bands

export function ManhattanPlot({ variants, yAxis = 'af' }: ManhattanPlotProps) {
  const layout = useMemo(() => {
    if (variants.length === 0) return null;

    const width = 720;
    const height = 260;
    const pad = { top: 16, right: 16, bottom: 40, left: 48 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    // Group by chromosome in ordinal order
    const byChrom = new Map<string, PooledAFVariant[]>();
    for (const v of variants) {
      const arr = byChrom.get(v.chrom);
      if (arr) arr.push(v);
      else byChrom.set(v.chrom, [v]);
    }
    const chroms = Array.from(byChrom.keys()).sort(
      (a, b) => chromOrdinal(a) - chromOrdinal(b),
    );
    for (const key of chroms) {
      const arr = byChrom.get(key);
      if (arr) arr.sort((a, b) => a.pos - b.pos);
    }

    // Allocate x space proportional to number of variants per chromosome so
    // every chromosome is visible even with sparse demo data.
    const total = variants.length;
    let xCursor = 0;
    const bands: Array<{ chrom: string; x0: number; x1: number }> = [];
    const points: Array<{
      x: number;
      y: number;
      variant: PooledAFVariant;
      color: string;
    }> = [];

    const yMax =
      yAxis === 'af'
        ? Math.max(0.001, ...variants.map((v) => v.af)) * 1.05
        : Math.max(1, ...variants.map((v) => v.ac)) * 1.05;
    const yMin = 0;

    chroms.forEach((chrom, i) => {
      const list = byChrom.get(chrom) ?? [];
      const share = list.length / total;
      const bandW = Math.max(8, plotW * share);
      const x0 = xCursor;
      const x1 = xCursor + bandW;
      bands.push({ chrom, x0, x1 });
      xCursor = x1;

      const color = CHROM_COLORS[i % CHROM_COLORS.length] ?? CHROM_COLORS[0]!;
      const minPos = list[0]?.pos ?? 0;
      const maxPos = list[list.length - 1]?.pos ?? minPos + 1;
      const posSpan = Math.max(1, maxPos - minPos);
      for (const v of list) {
        const rel = (v.pos - minPos) / posSpan;
        const x = x0 + rel * bandW;
        const value = yAxis === 'af' ? v.af : v.ac;
        const y = plotH - ((value - yMin) / (yMax - yMin)) * plotH;
        points.push({ x, y, variant: v, color });
      }
    });

    const yTicks = Array.from({ length: 5 }, (_, i) => {
      const frac = i / 4;
      const value = yMin + frac * (yMax - yMin);
      const y = plotH - frac * plotH;
      return { value, y };
    });

    return {
      width,
      height,
      pad,
      plotW,
      plotH,
      bands,
      points,
      yTicks,
    };
  }, [variants, yAxis]);

  if (!layout) {
    return (
      <div className="rounded-lg border border-white/5 bg-surface-card p-6 text-sm text-slate-400">
        Load a pooled-AF file to see the Manhattan plot.
      </div>
    );
  }

  const { width, height, pad, plotW, plotH, bands, points, yTicks } = layout;

  return (
    <div className="rounded-lg border border-white/5 bg-surface-card p-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Allele frequency Manhattan plot"
        className="w-full"
      >
        <g transform={`translate(${pad.left}, ${pad.top})`}>
          {bands.map((b, i) => (
            <rect
              key={b.chrom}
              x={b.x0}
              y={0}
              width={Math.max(0, b.x1 - b.x0)}
              height={plotH}
              className={i % 2 === 0 ? 'fill-white/[0.02]' : 'fill-white/[0.04]'}
            />
          ))}

          {yTicks.map((t) => (
            <g key={t.y}>
              <line
                x1={0}
                x2={plotW}
                y1={t.y}
                y2={t.y}
                className="stroke-white/5"
                strokeWidth={1}
              />
              <text
                x={-8}
                y={t.y + 3}
                textAnchor="end"
                className="fill-slate-500 text-[10px]"
              >
                {yAxis === 'af' ? t.value.toFixed(2) : Math.round(t.value)}
              </text>
            </g>
          ))}

          {points.map((p) => (
            <circle
              key={`${p.variant.chrom}-${p.variant.pos}-${p.variant.alt}`}
              cx={p.x}
              cy={p.y}
              r={2.5}
              fill={p.color}
              className="opacity-80"
            >
              <title>
                {p.variant.chrom}:{p.variant.pos} {p.variant.ref}&gt;
                {p.variant.alt}
                {'\n'}AC={p.variant.ac} AN={p.variant.an} AF=
                {p.variant.af.toFixed(4)}
              </title>
            </circle>
          ))}

          {bands.map((b) => (
            <text
              key={`lbl-${b.chrom}`}
              x={(b.x0 + b.x1) / 2}
              y={plotH + 16}
              textAnchor="middle"
              className="fill-slate-500 text-[10px]"
            >
              {b.chrom.replace(/^chr/i, '')}
            </text>
          ))}

          <text
            x={-pad.left + 12}
            y={plotH / 2}
            transform={`rotate(-90 ${-pad.left + 12} ${plotH / 2})`}
            textAnchor="middle"
            className="fill-slate-400 text-[11px]"
          >
            {yAxis === 'af' ? 'Allele frequency' : 'Allele count'}
          </text>
          <text
            x={plotW / 2}
            y={plotH + 32}
            textAnchor="middle"
            className="fill-slate-400 text-[11px]"
          >
            Chromosome
          </text>
        </g>
      </svg>
    </div>
  );
}

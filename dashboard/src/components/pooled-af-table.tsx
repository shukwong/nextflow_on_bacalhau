'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PooledAFVariant } from '@/lib/types';
import { cn } from '@/lib/utils';

type SortKey = 'chrom' | 'pos' | 'ac' | 'an' | 'af';
type SortDir = 'asc' | 'desc';

interface PooledAFTableProps {
  variants: PooledAFVariant[];
}

function compareVariants(
  a: PooledAFVariant,
  b: PooledAFVariant,
  key: SortKey,
): number {
  if (key === 'chrom') {
    return a.chrom.localeCompare(b.chrom, undefined, { numeric: true });
  }
  const av = a[key];
  const bv = b[key];
  return (av as number) - (bv as number);
}

export function PooledAFTable({ variants }: PooledAFTableProps) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('af');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? variants.filter((v) => {
          const label = `${v.chrom}:${v.pos} ${v.ref}>${v.alt}`.toLowerCase();
          return label.includes(q);
        })
      : variants;
    const sorted = [...filtered].sort((a, b) => compareVariants(a, b, sortKey));
    return sortDir === 'asc' ? sorted : sorted.reverse();
  }, [variants, query, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'chrom' || key === 'pos' ? 'asc' : 'desc');
    }
  };

  if (variants.length === 0) {
    return (
      <div className="rounded-lg border border-white/5 bg-surface-card p-6 text-sm text-slate-400">
        Load a pooled-AF file to populate the variant table.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search CHROM:POS or allele…"
          className="w-full rounded-lg border border-white/10 bg-surface-card py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div className="max-h-[480px] overflow-auto rounded-lg border border-white/5 bg-surface-card">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface-card text-xs uppercase tracking-wide text-slate-400 shadow-[0_1px_0_rgba(255,255,255,0.05)]">
            <tr>
              <SortHeader
                label="CHROM"
                active={sortKey === 'chrom'}
                dir={sortDir}
                onClick={() => toggleSort('chrom')}
              />
              <SortHeader
                label="POS"
                active={sortKey === 'pos'}
                dir={sortDir}
                onClick={() => toggleSort('pos')}
                numeric
              />
              <th className="px-3 py-2 font-medium">REF</th>
              <th className="px-3 py-2 font-medium">ALT</th>
              <SortHeader
                label="AC"
                active={sortKey === 'ac'}
                dir={sortDir}
                onClick={() => toggleSort('ac')}
                numeric
              />
              <SortHeader
                label="AN"
                active={sortKey === 'an'}
                dir={sortDir}
                onClick={() => toggleSort('an')}
                numeric
              />
              <SortHeader
                label="AF"
                active={sortKey === 'af'}
                dir={sortDir}
                onClick={() => toggleSort('af')}
                numeric
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visible.slice(0, 500).map((v, idx) => (
              <tr
                key={`${v.chrom}-${v.pos}-${v.ref}-${v.alt}-${idx}`}
                className="hover:bg-white/[0.02]"
              >
                <td className="px-3 py-2 font-mono text-xs text-slate-300">
                  {v.chrom}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-slate-300">
                  {v.pos.toLocaleString()}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-400">
                  {v.ref}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-400">
                  {v.alt}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-slate-200">
                  {v.ac}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-slate-200">
                  {v.an}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs text-state-info">
                  {v.af.toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Showing {Math.min(visible.length, 500)} of {variants.length} variants
        {visible.length > 500 ? ' (first 500 rendered)' : ''}
      </p>
    </div>
  );
}

interface SortHeaderProps {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  numeric?: boolean;
}

function SortHeader({ label, active, dir, onClick, numeric }: SortHeaderProps) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      className={cn(
        'px-3 py-2 font-medium',
        numeric && 'text-right',
      )}
    >
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

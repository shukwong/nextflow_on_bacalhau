'use client';

import { FileUp, RotateCcw } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { parsePooledAF } from '@/lib/pooled-af';
import type { PooledAFParseResult } from '@/lib/types';

interface PooledAFLoaderProps {
  onLoad: (result: PooledAFParseResult | null) => void;
  fileName: string | null;
}

export function PooledAFLoader({ onLoad, fileName }: PooledAFLoaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        const text = await file.text();
        const result = parsePooledAF(text, file.name);
        onLoad(result);
      } finally {
        setBusy(false);
      }
    },
    [onLoad],
  );

  const reset = () => {
    if (inputRef.current) inputRef.current.value = '';
    onLoad(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-white/15 bg-surface-card px-4 py-4">
      <FileUp className="h-5 w-5 text-accent" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-sm font-medium text-slate-200">
          Load pooled_af.tsv
        </p>
        <p className="text-xs text-slate-500">
          File is parsed in your browser — nothing is uploaded. Schema must be
          CHROM / POS / REF / ALT / AC / AN / AF.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {fileName ? (
          <span className="truncate rounded bg-white/5 px-2 py-1 font-mono text-xs text-slate-300">
            {fileName}
          </span>
        ) : null}
        <label className="cursor-pointer rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-accent/90">
          {busy ? 'Parsing…' : fileName ? 'Replace' : 'Choose file'}
          <input
            ref={inputRef}
            type="file"
            accept=".tsv,.txt,text/tab-separated-values,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </label>
        {fileName ? (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/5"
          >
            <RotateCcw className="h-3 w-3" />
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

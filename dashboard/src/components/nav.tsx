import Link from 'next/link';
import { Network, Table2 } from 'lucide-react';

export function Nav() {
  return (
    <nav className="border-b border-white/5 bg-surface-muted/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100 hover:text-white"
        >
          <Network className="h-4 w-4 text-accent" />
          nf-bacalhau · Federation
        </Link>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <Link className="hover:text-slate-100" href="/">
            Jobs
          </Link>
          <Link
            className="inline-flex items-center gap-1 hover:text-slate-100"
            href="/pooled-af"
          >
            <Table2 className="h-3 w-3" />
            Pooled AF
          </Link>
        </div>
      </div>
    </nav>
  );
}

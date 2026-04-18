import { CheckCircle2, ShieldAlert } from 'lucide-react';
import type { InvariantCheck } from '@/lib/types';
import { cn } from '@/lib/utils';

export function InvariantBanner({ checks }: { checks: InvariantCheck[] }) {
  const allOk = checks.length > 0 && checks.every((c) => c.ok);
  const Icon = allOk ? CheckCircle2 : ShieldAlert;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg px-4 py-3 ring-1 ring-inset',
        allOk
          ? 'bg-state-ok/10 ring-state-ok/30 text-state-ok'
          : 'bg-state-warn/10 ring-state-warn/30 text-state-warn',
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 flex-none" />
      <div className="text-sm">
        <p className="font-medium">
          {allOk
            ? 'Privacy invariant holds — aggregate counts only'
            : 'Invariant checks pending or failing'}
        </p>
        <p className="mt-0.5 text-xs opacity-80">
          Dashboard never displays genotypes or sample IDs. Output schema is
          restricted to CHROM/POS/REF/ALT/AC/AN/AF.
        </p>
      </div>
    </div>
  );
}

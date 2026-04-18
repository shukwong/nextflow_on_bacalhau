'use client';

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  CheckCircle2,
  Circle,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useAllSiteHealth } from '@/hooks/use-coordinator';
import { useSites } from '@/lib/sites-context';
import type { SiteConfig } from '@/lib/sites-storage';
import { cn } from '@/lib/utils';

interface DraftState {
  label: string;
  coordinatorUrl: string;
  operatorToken: string;
}

const EMPTY_DRAFT: DraftState = {
  label: '',
  coordinatorUrl: '',
  operatorToken: '',
};

export default function SettingsPage() {
  const {
    sites,
    activeSiteId,
    hydrated,
    addSite,
    updateSite,
    removeSite,
    setActiveSiteId,
  } = useSites();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  const probes = useAllSiteHealth(sites);

  useEffect(() => {
    if (!editingId) return;
    const site = sites.find((s) => s.id === editingId);
    if (!site) {
      setEditingId(null);
      return;
    }
    setDraft({
      label: site.label,
      coordinatorUrl: site.coordinatorUrl,
      operatorToken: site.operatorToken ?? '',
    });
  }, [editingId, sites]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!draft.label.trim() || !draft.coordinatorUrl.trim()) {
      setError('Label and coordinator URL are required.');
      return;
    }
    try {
      new URL(draft.coordinatorUrl);
    } catch {
      setError('Coordinator URL must be a valid http(s) URL.');
      return;
    }
    const payload = {
      label: draft.label.trim(),
      coordinatorUrl: draft.coordinatorUrl.trim(),
      operatorToken: draft.operatorToken.trim() || undefined,
    };
    if (editingId) {
      updateSite(editingId, payload);
      setEditingId(null);
    } else {
      addSite(payload);
      setShowAdd(false);
    }
    setDraft(EMPTY_DRAFT);
  };

  const handleCancel = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setShowAdd(false);
    setError(null);
  };

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-100">
            Site coordinators
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Each row is one institution&apos;s coordinator. Tokens stay in this
            browser&apos;s local storage — see the design doc &sect;10 for the
            known trade-off. An XSS in this dashboard would leak them.
          </p>
        </div>
        {!showAdd && !editingId ? (
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_DRAFT);
              setShowAdd(true);
            }}
            className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent ring-1 ring-inset ring-accent/30 hover:bg-accent/25"
          >
            <Plus className="h-3 w-3" />
            Add site
          </button>
        ) : null}
      </header>

      {(showAdd || editingId) && (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-white/10 bg-surface-card p-4"
        >
          <h2 className="text-sm font-medium text-slate-100">
            {editingId ? 'Edit site' : 'Add site'}
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="Label" htmlFor="label">
              <input
                id="label"
                value={draft.label}
                onChange={(e) =>
                  setDraft({ ...draft, label: e.target.value })
                }
                placeholder="e.g. Site A — Oxford"
                className="w-full rounded-md border border-white/10 bg-surface-muted px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-accent/50"
              />
            </Field>
            <Field label="Coordinator URL" htmlFor="url">
              <input
                id="url"
                value={draft.coordinatorUrl}
                onChange={(e) =>
                  setDraft({ ...draft, coordinatorUrl: e.target.value })
                }
                placeholder="https://coord.site-a.example"
                className="w-full rounded-md border border-white/10 bg-surface-muted px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-accent/50"
              />
            </Field>
            <Field label="Operator token (optional)" htmlFor="token">
              <input
                id="token"
                type="password"
                value={draft.operatorToken}
                onChange={(e) =>
                  setDraft({ ...draft, operatorToken: e.target.value })
                }
                placeholder="Bearer token shared by the site operator"
                className="w-full rounded-md border border-white/10 bg-surface-muted px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-accent/50"
                autoComplete="off"
              />
            </Field>
          </div>
          {error && (
            <p className="mt-2 text-xs text-state-err">{error}</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="submit"
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-accent/90"
            >
              {editingId ? 'Save' : 'Add'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-lg border border-white/5 bg-surface-card">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-muted/40 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Active</th>
              <th className="px-4 py-2 text-left">Label</th>
              <th className="px-4 py-2 text-left">Coordinator</th>
              <th className="px-4 py-2 text-left">Health</th>
              <th className="px-4 py-2 text-left">Token</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {!hydrated ? (
              <EmptyRow message="Loading saved sites…" />
            ) : sites.length === 0 ? (
              <EmptyRow message="No sites configured yet. Click Add site to register your first coordinator." />
            ) : (
              sites.map((site, idx) => (
                <SiteRow
                  key={site.id}
                  site={site}
                  active={site.id === activeSiteId}
                  probe={probes[idx]}
                  onActivate={() => setActiveSiteId(site.id)}
                  onEdit={() => {
                    setShowAdd(false);
                    setEditingId(site.id);
                  }}
                  onDelete={() => {
                    if (
                      window.confirm(
                        `Remove ${site.label}? Local token is deleted; the coordinator is not touched.`,
                      )
                    ) {
                      removeSite(site.id);
                    }
                  }}
                />
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      {children}
    </label>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
        {message}
      </td>
    </tr>
  );
}

interface SiteRowProps {
  site: SiteConfig;
  active: boolean;
  probe: ReturnType<typeof useAllSiteHealth>[number] | undefined;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SiteRow({ site, active, probe, onActivate, onEdit, onDelete }: SiteRowProps) {
  const health = useMemo(() => {
    if (!probe || probe.isLoading) return { label: 'checking…', tone: 'idle' as const };
    const data = probe.data;
    if (data?.ok && data.health) {
      return {
        label: `ok · ${data.health.site_id}`,
        tone: 'ok' as const,
      };
    }
    return { label: data?.error ?? 'unreachable', tone: 'err' as const };
  }, [probe]);

  const [copied, setCopied] = useState(false);
  const copyToken = async () => {
    if (!site.operatorToken) return;
    try {
      await navigator.clipboard.writeText(site.operatorToken);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may be denied in insecure contexts; silently drop.
    }
  };

  return (
    <tr className="border-t border-white/5">
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={onActivate}
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-100"
          aria-label={active ? 'Active site' : 'Make this the active site'}
        >
          {active ? (
            <CheckCircle2 className="h-4 w-4 text-accent" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </button>
      </td>
      <td className="px-4 py-3 text-slate-100">{site.label}</td>
      <td className="px-4 py-3 font-mono text-xs text-slate-400">
        {site.coordinatorUrl}
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset',
            health.tone === 'ok' &&
              'bg-state-ok/15 text-state-ok ring-state-ok/30',
            health.tone === 'err' &&
              'bg-state-err/15 text-state-err ring-state-err/30',
            health.tone === 'idle' &&
              'bg-state-idle/15 text-slate-400 ring-state-idle/30',
          )}
          title={health.label}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          <span className="max-w-[14rem] truncate">{health.label}</span>
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">
        {site.operatorToken ? (
          <button
            type="button"
            onClick={copyToken}
            className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-0.5 font-mono text-[11px] hover:bg-white/5"
            title="Copy token to clipboard"
          >
            {copied ? 'copied ✓' : '•••• copy'}
          </button>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-slate-100"
            aria-label={`Edit ${site.label}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-1 text-slate-400 hover:bg-state-err/10 hover:text-state-err"
            aria-label={`Remove ${site.label}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

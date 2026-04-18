/**
 * Per-institution coordinator configuration, persisted in localStorage.
 *
 * Tokens live in the browser. That's an MVP choice documented in
 * design/federation-dashboard.md §10 — any XSS in the dashboard would
 * leak them. The upgrade path is a server-side secret store; we ship
 * localStorage first so a fresh install can be used without a backend.
 */

import { z } from 'zod';

const STORAGE_KEY = 'federation-sites-v1';

const httpUrlSchema = z
  .string()
  .url()
  .refine(
    (v) => {
      try {
        const proto = new URL(v).protocol;
        return proto === 'http:' || proto === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Coordinator URL must use http:// or https://' },
  );

const siteConfigSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  coordinatorUrl: httpUrlSchema,
  operatorToken: z.string().optional(),
});

const siteStoreSchema = z.object({
  version: z.literal(1),
  sites: z.array(siteConfigSchema),
  activeSiteId: z.string().nullable(),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type SiteStore = z.infer<typeof siteStoreSchema>;

export const EMPTY_STORE: SiteStore = { version: 1, sites: [], activeSiteId: null };

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadSites(): SiteStore {
  if (!isBrowser()) return EMPTY_STORE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY_STORE;
  try {
    const parsed = siteStoreSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_STORE;
  } catch {
    return EMPTY_STORE;
  }
}

export function saveSites(store: SiteStore): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function makeSiteId(): string {
  // Short, URL-safe, random. No collisions matter at N<20 sites per dashboard.
  return `site-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeCoordinatorUrl(url: string): string {
  // Strip trailing slash so clients can always append `/v1/...`.
  return url.replace(/\/+$/, '');
}

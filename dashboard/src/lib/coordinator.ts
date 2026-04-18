/**
 * Typed HTTP client for a single site-coordinator instance.
 *
 * The coordinator enforces CORS for http://localhost:3000 by default
 * (see site-coordinator/src/site_coordinator/main.py). For production
 * deployments with a different dashboard origin, the coordinator's
 * `allowed_origins` list must be updated out-of-band.
 */

import type {
  CoordinatorHealth,
  CoordinatorProbe,
  CoordinatorRunAcceptance,
  CoordinatorRunList,
  CoordinatorRunRequest,
  CoordinatorSiteRun,
} from './coordinator-types';
import type { SiteConfig } from './sites-storage';

export class CoordinatorError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function authHeaders(site: Pick<SiteConfig, 'operatorToken'>): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (site.operatorToken) {
    headers.Authorization = `Bearer ${site.operatorToken}`;
  }
  return headers;
}

async function request<T>(
  site: SiteConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${site.coordinatorUrl}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(site), ...(init.headers ?? {}) },
    cache: 'no-store',
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let body: unknown = raw || null;
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
    }
    throw new CoordinatorError(
      `${site.label} (${site.coordinatorUrl}) → HTTP ${res.status}`,
      res.status,
      body,
    );
  }

  return (await res.json()) as T;
}

export async function probeCoordinator(site: SiteConfig): Promise<CoordinatorProbe> {
  try {
    const health = await request<CoordinatorHealth>(site, '/v1/healthz');
    return { ok: true, health };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function listRuns(
  site: SiteConfig,
  params: { limit?: number; state?: string } = {},
): Promise<CoordinatorRunList> {
  const qs = new URLSearchParams();
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.state) qs.set('state', params.state);
  const suffix = qs.toString();
  return request<CoordinatorRunList>(
    site,
    `/v1/runs${suffix ? `?${suffix}` : ''}`,
  );
}

export async function getRun(
  site: SiteConfig,
  runId: string,
): Promise<CoordinatorSiteRun> {
  return request<CoordinatorSiteRun>(site, `/v1/runs/${runId}`);
}

export async function createRun(
  site: SiteConfig,
  body: CoordinatorRunRequest,
): Promise<CoordinatorRunAcceptance> {
  return request<CoordinatorRunAcceptance>(site, '/v1/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function cancelRun(
  site: SiteConfig,
  runId: string,
): Promise<CoordinatorSiteRun> {
  return request<CoordinatorSiteRun>(site, `/v1/runs/${runId}/cancel`, {
    method: 'POST',
  });
}

export async function getCountsUrl(
  site: SiteConfig,
  runId: string,
): Promise<string> {
  // Returned as a URL rather than a Blob so the browser can download or stream.
  return `${site.coordinatorUrl}/v1/counts/${runId}`;
}

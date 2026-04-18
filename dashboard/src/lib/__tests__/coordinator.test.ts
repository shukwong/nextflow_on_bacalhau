import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CoordinatorError,
  createRun,
  getCountsUrl,
  getRun,
  listRuns,
  probeCoordinator,
} from '@/lib/coordinator';
import type { SiteConfig } from '@/lib/sites-storage';

const site: SiteConfig = {
  id: 'site-1',
  label: 'Site A',
  coordinatorUrl: 'https://a.example',
  operatorToken: 'secret',
};

const siteNoToken: SiteConfig = {
  id: 'site-2',
  label: 'Site B',
  coordinatorUrl: 'https://b.example',
};

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    return handler(url, init ?? {});
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request wiring', () => {
  it('sends Authorization bearer when token present', async () => {
    const spy = mockFetch(() =>
      new Response(JSON.stringify({ runs: [], total: 0 }), { status: 200 }),
    );
    await listRuns(site);
    const init = spy.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer secret');
  });

  it('omits Authorization when no token configured', async () => {
    const spy = mockFetch(() =>
      new Response(JSON.stringify({ runs: [], total: 0 }), { status: 200 }),
    );
    await listRuns(siteNoToken);
    const init = spy.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('builds query string for listRuns', async () => {
    const spy = mockFetch(() =>
      new Response(JSON.stringify({ runs: [], total: 0 }), { status: 200 }),
    );
    await listRuns(site, { limit: 5, state: 'running' });
    const url = spy.mock.calls[0]![0] as string;
    expect(url).toBe('https://a.example/v1/runs?limit=5&state=running');
  });
});

describe('error mapping', () => {
  it('throws CoordinatorError with status and JSON body on non-2xx', async () => {
    mockFetch(() =>
      new Response(JSON.stringify({ detail: 'nope' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(getRun(site, 'abc')).rejects.toMatchObject({
      name: 'Error',
      status: 403,
      body: { detail: 'nope' },
    });
  });

  it('captures plain-text body when response is not JSON', async () => {
    mockFetch(() => new Response('Gateway timeout', { status: 504 }));
    try {
      await getRun(site, 'abc');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(CoordinatorError);
      const ce = err as CoordinatorError;
      expect(ce.status).toBe(504);
      expect(ce.body).toBe('Gateway timeout');
    }
  });
});

describe('probeCoordinator', () => {
  it('returns ok=true with health payload on success', async () => {
    const health = {
      ok: true,
      version: '0.1.0',
      site_id: 'demo',
      bacalhau_reachable: true,
      now: '2026-04-18T00:00:00Z',
    };
    mockFetch(() => new Response(JSON.stringify(health), { status: 200 }));
    const probe = await probeCoordinator(site);
    expect(probe).toEqual({ ok: true, health });
  });

  it('returns ok=false with error message on failure', async () => {
    mockFetch(() => new Response('down', { status: 500 }));
    const probe = await probeCoordinator(site);
    expect(probe.ok).toBe(false);
    expect(probe.error).toContain('HTTP 500');
  });
});

describe('createRun', () => {
  it('POSTs JSON body with content-type', async () => {
    const spy = mockFetch((_url, init) =>
      new Response(
        JSON.stringify({
          run_id: 'r1',
          state: 'pending',
          site_id: 'demo',
          started_at: '2026-04-18T00:00:00Z',
        }),
        { status: 202 },
      ),
    );
    await createRun(site, { shard_ref: 's1' });
    const init = spy.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ shard_ref: 's1' }));
  });
});

describe('getCountsUrl', () => {
  it('concatenates base URL with counts path', async () => {
    const url = await getCountsUrl(site, 'run-123');
    expect(url).toBe('https://a.example/v1/counts/run-123');
  });
});

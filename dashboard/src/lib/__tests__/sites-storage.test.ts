import { afterEach, describe, expect, it } from 'vitest';
import {
  EMPTY_STORE,
  loadSites,
  makeSiteId,
  normalizeCoordinatorUrl,
  saveSites,
  type SiteStore,
} from '@/lib/sites-storage';

const KEY = 'federation-sites-v1';

afterEach(() => {
  window.localStorage.clear();
});

describe('normalizeCoordinatorUrl', () => {
  it('strips trailing slash', () => {
    expect(normalizeCoordinatorUrl('https://host.example/')).toBe(
      'https://host.example',
    );
  });
  it('strips multiple trailing slashes', () => {
    expect(normalizeCoordinatorUrl('https://host.example///')).toBe(
      'https://host.example',
    );
  });
  it('leaves a clean URL alone', () => {
    expect(normalizeCoordinatorUrl('https://host.example')).toBe(
      'https://host.example',
    );
  });
});

describe('makeSiteId', () => {
  it('produces the site- prefix', () => {
    expect(makeSiteId().startsWith('site-')).toBe(true);
  });
  it('returns fresh ids on each call', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) seen.add(makeSiteId());
    expect(seen.size).toBe(50);
  });
});

describe('loadSites / saveSites', () => {
  it('returns EMPTY_STORE when nothing saved', () => {
    expect(loadSites()).toEqual(EMPTY_STORE);
  });

  it('round-trips a valid store', () => {
    const store: SiteStore = {
      version: 1,
      sites: [
        {
          id: 'site-1',
          label: 'Site A',
          coordinatorUrl: 'https://a.example',
          operatorToken: 'tok',
        },
      ],
      activeSiteId: 'site-1',
    };
    saveSites(store);
    expect(loadSites()).toEqual(store);
  });

  it('rejects malformed JSON and returns EMPTY_STORE', () => {
    window.localStorage.setItem(KEY, 'not-json');
    expect(loadSites()).toEqual(EMPTY_STORE);
  });

  it('rejects a payload with an invalid URL', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        sites: [{ id: 'x', label: 'x', coordinatorUrl: 'not-a-url' }],
        activeSiteId: null,
      }),
    );
    expect(loadSites()).toEqual(EMPTY_STORE);
  });

  it('rejects a payload with wrong schema version', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ version: 2, sites: [], activeSiteId: null }),
    );
    expect(loadSites()).toEqual(EMPTY_STORE);
  });

  it('rejects coordinatorUrl with non-http(s) scheme (ftp)', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        sites: [
          {
            id: 'site-1',
            label: 'Bad',
            coordinatorUrl: 'ftp://host.example/',
          },
        ],
        activeSiteId: 'site-1',
      }),
    );
    expect(loadSites()).toEqual(EMPTY_STORE);
  });

  it('rejects coordinatorUrl with non-http(s) scheme (mailto)', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        sites: [
          {
            id: 'site-1',
            label: 'Bad',
            coordinatorUrl: 'mailto:op@example.com',
          },
        ],
        activeSiteId: 'site-1',
      }),
    );
    expect(loadSites()).toEqual(EMPTY_STORE);
  });

  it('accepts coordinatorUrl with https scheme', () => {
    const store: SiteStore = {
      version: 1,
      sites: [
        {
          id: 'site-1',
          label: 'OK',
          coordinatorUrl: 'https://host.example',
        },
      ],
      activeSiteId: 'site-1',
    };
    saveSites(store);
    expect(loadSites()).toEqual(store);
  });
});

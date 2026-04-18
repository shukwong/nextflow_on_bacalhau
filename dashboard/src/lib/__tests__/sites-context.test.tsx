import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { SitesProvider, useSites } from '@/lib/sites-context';
import { loadSites } from '@/lib/sites-storage';

function Wrapper({ children }: { children: ReactNode }) {
  return <SitesProvider>{children}</SitesProvider>;
}

afterEach(() => {
  window.localStorage.clear();
});

describe('SitesProvider', () => {
  it('hydrates to empty store on first mount', async () => {
    const { result } = renderHook(() => useSites(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.sites).toEqual([]);
    expect(result.current.activeSiteId).toBeNull();
  });

  it('adds a site and marks it active when none was active', async () => {
    const { result } = renderHook(() => useSites(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => {
      result.current.addSite({
        label: 'Site A',
        coordinatorUrl: 'https://a.example/',
      });
    });
    expect(result.current.sites).toHaveLength(1);
    expect(result.current.sites[0]!.coordinatorUrl).toBe('https://a.example');
    expect(result.current.activeSiteId).toBe(result.current.sites[0]!.id);
  });

  it('does not change active site when a second site is added', async () => {
    const { result } = renderHook(() => useSites(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => {
      result.current.addSite({ label: 'A', coordinatorUrl: 'https://a.example' });
    });
    const firstId = result.current.activeSiteId;
    act(() => {
      result.current.addSite({ label: 'B', coordinatorUrl: 'https://b.example' });
    });
    expect(result.current.activeSiteId).toBe(firstId);
  });

  it('updates a site and re-normalizes its URL', async () => {
    const { result } = renderHook(() => useSites(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    let id = '';
    act(() => {
      const created = result.current.addSite({
        label: 'A',
        coordinatorUrl: 'https://a.example',
      });
      id = created.id;
    });
    act(() => {
      result.current.updateSite(id, { coordinatorUrl: 'https://a2.example/' });
    });
    expect(result.current.sites[0]!.coordinatorUrl).toBe('https://a2.example');
  });

  it('removes a site and picks another as active', async () => {
    const { result } = renderHook(() => useSites(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    let firstId = '';
    let secondId = '';
    act(() => {
      firstId = result.current.addSite({
        label: 'A',
        coordinatorUrl: 'https://a.example',
      }).id;
    });
    act(() => {
      secondId = result.current.addSite({
        label: 'B',
        coordinatorUrl: 'https://b.example',
      }).id;
    });
    expect(result.current.activeSiteId).toBe(firstId);
    act(() => {
      result.current.removeSite(firstId);
    });
    expect(result.current.sites).toHaveLength(1);
    expect(result.current.activeSiteId).toBe(secondId);
  });

  it('persists to localStorage', async () => {
    const { result } = renderHook(() => useSites(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    act(() => {
      result.current.addSite({
        label: 'Persist',
        coordinatorUrl: 'https://p.example',
      });
    });
    const reloaded = loadSites();
    expect(reloaded.sites).toHaveLength(1);
    expect(reloaded.sites[0]!.label).toBe('Persist');
  });

  it('clears activeSiteId when the last site is removed', async () => {
    const { result } = renderHook(() => useSites(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    let id = '';
    act(() => {
      id = result.current.addSite({
        label: 'Solo',
        coordinatorUrl: 'https://s.example',
      }).id;
    });
    act(() => {
      result.current.removeSite(id);
    });
    expect(result.current.activeSiteId).toBeNull();
    expect(result.current.sites).toEqual([]);
  });
});

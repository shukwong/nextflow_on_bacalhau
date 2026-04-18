'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  EMPTY_STORE as EMPTY,
  loadSites,
  makeSiteId,
  normalizeCoordinatorUrl,
  saveSites,
  type SiteConfig,
  type SiteStore,
} from './sites-storage';

interface SitesContextValue {
  sites: SiteConfig[];
  activeSiteId: string | null;
  hydrated: boolean;
  addSite: (draft: Omit<SiteConfig, 'id'>) => SiteConfig;
  updateSite: (id: string, patch: Partial<Omit<SiteConfig, 'id'>>) => void;
  removeSite: (id: string) => void;
  setActiveSiteId: (id: string | null) => void;
  getSite: (id: string) => SiteConfig | undefined;
}

const SitesContext = createContext<SitesContextValue | null>(null);

function persistAndReturn(store: SiteStore): SiteStore {
  saveSites(store);
  return store;
}

export function SitesProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<SiteStore>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setStore(loadSites());
    setHydrated(true);
  }, []);

  const addSite = useCallback((draft: Omit<SiteConfig, 'id'>): SiteConfig => {
    const site: SiteConfig = {
      id: makeSiteId(),
      label: draft.label,
      coordinatorUrl: normalizeCoordinatorUrl(draft.coordinatorUrl),
      operatorToken: draft.operatorToken,
    };
    setStore((prev) =>
      persistAndReturn({
        ...prev,
        sites: [...prev.sites, site],
        activeSiteId: prev.activeSiteId ?? site.id,
      }),
    );
    return site;
  }, []);

  const updateSite = useCallback(
    (id: string, patch: Partial<Omit<SiteConfig, 'id'>>) => {
      setStore((prev) =>
        persistAndReturn({
          ...prev,
          sites: prev.sites.map((s) =>
            s.id === id
              ? {
                  ...s,
                  ...patch,
                  coordinatorUrl:
                    patch.coordinatorUrl != null
                      ? normalizeCoordinatorUrl(patch.coordinatorUrl)
                      : s.coordinatorUrl,
                }
              : s,
          ),
        }),
      );
    },
    [],
  );

  const removeSite = useCallback((id: string) => {
    setStore((prev) => {
      const sites = prev.sites.filter((s) => s.id !== id);
      const activeSiteId =
        prev.activeSiteId === id ? (sites[0]?.id ?? null) : prev.activeSiteId;
      return persistAndReturn({ ...prev, sites, activeSiteId });
    });
  }, []);

  const setActiveSiteId = useCallback((id: string | null) => {
    setStore((prev) => persistAndReturn({ ...prev, activeSiteId: id }));
  }, []);

  const getSite = useCallback(
    (id: string) => store.sites.find((s) => s.id === id),
    [store.sites],
  );

  const value = useMemo<SitesContextValue>(
    () => ({
      sites: store.sites,
      activeSiteId: store.activeSiteId,
      hydrated,
      addSite,
      updateSite,
      removeSite,
      setActiveSiteId,
      getSite,
    }),
    [
      store.sites,
      store.activeSiteId,
      hydrated,
      addSite,
      updateSite,
      removeSite,
      setActiveSiteId,
      getSite,
    ],
  );

  return <SitesContext.Provider value={value}>{children}</SitesContext.Provider>;
}

export function useSites(): SitesContextValue {
  const ctx = useContext(SitesContext);
  if (!ctx) {
    throw new Error('useSites must be used within a SitesProvider');
  }
  return ctx;
}

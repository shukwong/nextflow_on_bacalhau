'use client';

import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  getRun,
  listRuns,
  probeCoordinator,
} from '@/lib/coordinator';
import type {
  CoordinatorProbe,
  CoordinatorRunList,
  CoordinatorSiteRun,
} from '@/lib/coordinator-types';
import type { SiteConfig } from '@/lib/sites-storage';

const HEALTH_POLL_MS = 10_000;
const RUNS_POLL_MS = 5_000;

export function useSiteHealth(site: SiteConfig | undefined) {
  return useQuery<CoordinatorProbe>({
    queryKey: ['coord', site?.id, 'health'],
    queryFn: () => probeCoordinator(site as SiteConfig),
    enabled: !!site,
    refetchInterval: HEALTH_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

/**
 * Fan out a health probe across every configured site. Each site gets its own
 * query so one unreachable coordinator doesn't stall the rest.
 */
export function useAllSiteHealth(
  sites: SiteConfig[],
): UseQueryResult<CoordinatorProbe>[] {
  return useQueries({
    queries: sites.map((site) => ({
      queryKey: ['coord', site.id, 'health'],
      queryFn: () => probeCoordinator(site),
      refetchInterval: HEALTH_POLL_MS,
      refetchIntervalInBackground: false,
    })),
  });
}

export function useSiteRuns(
  site: SiteConfig | undefined,
  params: { limit?: number; state?: string } = {},
) {
  return useQuery<CoordinatorRunList>({
    queryKey: ['coord', site?.id, 'runs', params],
    queryFn: () => listRuns(site as SiteConfig, params),
    enabled: !!site,
    refetchInterval: RUNS_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

/**
 * Fan out the run list across every site. Each result holds the runs for its
 * site; the caller can zip/flatten without losing the site->run mapping.
 */
export function useAllSiteRuns(
  sites: SiteConfig[],
  params: { limit?: number; state?: string } = {},
): UseQueryResult<CoordinatorRunList>[] {
  return useQueries({
    queries: sites.map((site) => ({
      queryKey: ['coord', site.id, 'runs', params],
      queryFn: () => listRuns(site, params),
      refetchInterval: RUNS_POLL_MS,
      refetchIntervalInBackground: false,
    })),
  });
}

export function useSiteRun(
  site: SiteConfig | undefined,
  runId: string | undefined,
) {
  return useQuery<CoordinatorSiteRun>({
    queryKey: ['coord', site?.id, 'run', runId],
    queryFn: () => getRun(site as SiteConfig, runId as string),
    enabled: !!site && !!runId,
    refetchInterval: RUNS_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

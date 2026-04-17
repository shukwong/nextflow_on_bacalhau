'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  BacalhauAgentResponse,
  BacalhauJobListResponse,
  BacalhauJobSummary,
} from '@/lib/types';

const POLL_MS = 2000;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Bacalhau ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export function useBacalhauNode() {
  return useQuery({
    queryKey: ['bacalhau', 'agent', 'node'],
    queryFn: () => fetchJson<BacalhauAgentResponse>('/api/bacalhau/api/v1/agent/node'),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useBacalhauJobs(): {
  jobs: BacalhauJobSummary[];
  isLoading: boolean;
  error: Error | null;
  isFetching: boolean;
} {
  const query = useQuery({
    queryKey: ['bacalhau', 'jobs', 'list'],
    queryFn: () =>
      fetchJson<BacalhauJobListResponse>(
        '/api/bacalhau/api/v1/orchestrator/jobs?limit=50',
      ),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });

  return {
    jobs: query.data?.Items ?? [],
    isLoading: query.isLoading,
    error: (query.error as Error | null) ?? null,
    isFetching: query.isFetching,
  };
}

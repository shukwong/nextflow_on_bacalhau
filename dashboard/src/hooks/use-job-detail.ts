'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  BacalhauExecution,
  BacalhauExecutionListResponse,
  BacalhauJobDetail,
  BacalhauJobDetailResponse,
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

export function useJobDetail(jobId: string) {
  const job = useQuery({
    queryKey: ['bacalhau', 'jobs', jobId],
    queryFn: () =>
      fetchJson<BacalhauJobDetailResponse>(
        `/api/bacalhau/api/v1/orchestrator/jobs/${encodeURIComponent(jobId)}`,
      ),
    enabled: Boolean(jobId),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });

  const executions = useQuery({
    queryKey: ['bacalhau', 'jobs', jobId, 'executions'],
    queryFn: () =>
      fetchJson<BacalhauExecutionListResponse>(
        `/api/bacalhau/api/v1/orchestrator/jobs/${encodeURIComponent(jobId)}/executions`,
      ),
    enabled: Boolean(jobId),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });

  return {
    job: job.data?.Job as BacalhauJobDetail | undefined,
    executions: (executions.data?.Items ?? []) as BacalhauExecution[],
    isLoading: job.isLoading || executions.isLoading,
    isFetching: job.isFetching || executions.isFetching,
    error: (job.error as Error | null) ?? (executions.error as Error | null) ?? null,
  };
}

/**
 * TypeScript mirrors of the site-coordinator Pydantic models.
 *
 * Source of truth: site-coordinator/src/site_coordinator/models.py.
 * Keep these in sync when the coordinator schema changes.
 *
 * Privacy invariant: no per-sample or genotype fields exist here. The
 * coordinator only returns aggregate counts metadata (AC/AN/AF); it
 * refuses to publish counts.tsv unless its own invariant check passes.
 */

export type CoordinatorRunState =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type CoordinatorTaskState =
  | 'submitted'
  | 'running'
  | 'completed'
  | 'failed';

export interface CoordinatorInvariantCheck {
  name: string;
  expected: string;
  observed: string;
  passed: boolean;
}

export interface CoordinatorInvariantResult {
  ok: boolean;
  checks: CoordinatorInvariantCheck[];
}

export interface CoordinatorTaskSnapshot {
  name: string;
  bacalhau_job_id: string | null;
  state: CoordinatorTaskState;
}

export interface CoordinatorSiteRun {
  run_id: string;
  site_id: string;
  pipeline_ref: string;
  shard_ref: string;
  state: CoordinatorRunState;
  started_at: string; // ISO-8601
  finished_at: string | null;
  tasks: CoordinatorTaskSnapshot[];
  invariant: CoordinatorInvariantResult | null;
  result_digest: string | null;
}

export interface CoordinatorRunList {
  runs: CoordinatorSiteRun[];
  total: number;
}

export interface CoordinatorRunRequest {
  shard_ref: string;
  pipeline_ref?: string;
  config_ref?: string | null;
}

export interface CoordinatorRunAcceptance {
  run_id: string;
  state: CoordinatorRunState;
  site_id: string;
  started_at: string;
}

export interface CoordinatorHealth {
  ok: boolean;
  version: string;
  site_id: string;
  bacalhau_reachable: boolean;
  now: string;
}

/** Mapped from HTTP responses; `ok=false` means we didn't reach the coordinator. */
export interface CoordinatorProbe {
  ok: boolean;
  health?: CoordinatorHealth;
  error?: string;
}

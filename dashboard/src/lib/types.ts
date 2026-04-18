/**
 * Bacalhau REST API types (subset) + federation types used by the dashboard.
 *
 * Privacy invariant (M1/M2):
 *   These types intentionally exclude fields that could carry per-individual
 *   genotype data. The dashboard must never receive or render genotypes — it
 *   only shows aggregate counts (AC, AN, AF) published by the federated-AF
 *   workflow. See design/federation-dashboard.md §6.
 */

export type JobState =
  | 'Pending'
  | 'Queued'
  | 'Running'
  | 'Completed'
  | 'Failed'
  | 'Cancelled'
  | 'Stopped'
  | 'Unknown';

export interface BacalhauJobSummary {
  ID: string;
  Name?: string;
  Namespace?: string;
  Type?: string;
  CreateTime?: number;
  ModifyTime?: number;
  State?: {
    StateType: JobState | string;
    Message?: string;
  };
  Labels?: Record<string, string>;
}

export interface BacalhauJobListResponse {
  Items?: BacalhauJobSummary[];
  NextToken?: string;
}

export interface BacalhauNodeInfo {
  NodeID?: string;
  PeerID?: string;
  NodeType?: string;
  Labels?: Record<string, string>;
  BacalhauVersion?: {
    Major?: string;
    Minor?: string;
    GitVersion?: string;
    BuildDate?: string;
  };
  SupportedProtocols?: string[];
}

export interface BacalhauAgentResponse {
  NodeInfo?: BacalhauNodeInfo;
}

/**
 * Detailed job record returned by GET /orchestrator/jobs/{id}.
 * We pull a minimal subset — enough to render the detail page without
 * carrying anything that could leak data.
 */
export interface BacalhauJobTask {
  Name?: string;
  Engine?: {
    Type?: string;
    Params?: Record<string, unknown>;
  };
  Resources?: {
    CPU?: string;
    Memory?: string;
    Disk?: string;
    GPU?: string;
  };
  Network?: {
    Type?: string;
  };
  Timeouts?: Record<string, number>;
}

export interface BacalhauJobDetail extends BacalhauJobSummary {
  Count?: number;
  Version?: number;
  Revision?: number;
  Tasks?: BacalhauJobTask[];
}

export interface BacalhauJobDetailResponse {
  Job?: BacalhauJobDetail;
}

/**
 * Execution = one concrete attempt at running the job on a node.
 * A single job may have several executions across retries / sites.
 */
export interface BacalhauExecution {
  ID: string;
  JobID?: string;
  NodeID?: string;
  Namespace?: string;
  CreateTime?: number;
  ModifyTime?: number;
  ComputeState?: {
    StateType?: string;
    Message?: string;
  };
  DesiredState?: {
    StateType?: string;
    Message?: string;
  };
  RunOutput?: {
    exitCode?: number;
    runnerError?: string;
    stdout?: string;
    stdouttruncated?: boolean;
    stderr?: string;
    stderrtruncated?: boolean;
  };
}

export interface BacalhauExecutionListResponse {
  Items?: BacalhauExecution[];
  NextToken?: string;
}

/**
 * Privacy-safe federation types.
 *
 * Note: no `genotypes`, `samples`, `individualIDs`, or similar fields exist
 * here by design. The type system enforces the privacy invariant.
 */
export interface SiteRun {
  siteId: string;
  nodeLabel: string;
  shardName: string;
  jobId: string;
  state: JobState | string;
  startedAt?: number;
  finishedAt?: number;
}

export interface FederationRun {
  federationRunId: string;
  startedAt: number;
  sites: SiteRun[];
  aggregator?: SiteRun;
}

export interface InvariantCheck {
  name:
    | 'no-genotypes-in-output'
    | 'counts-only'
    | 'size-bound'
    | 'schema-ok'
    | 'no-sample-ids';
  ok: boolean;
  detail?: string;
}

/**
 * Pooled-AF record parsed from the aggregator output TSV.
 *
 * Only aggregate counts per variant site — no per-sample columns.
 */
export interface PooledAFVariant {
  chrom: string;
  pos: number;
  ref: string;
  alt: string;
  ac: number;
  an: number;
  af: number;
}

export interface PooledAFParseResult {
  variants: PooledAFVariant[];
  invariants: InvariantCheck[];
  errors: string[];
  fileName: string;
  rowCount: number;
}

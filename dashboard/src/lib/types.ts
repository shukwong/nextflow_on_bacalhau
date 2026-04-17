/**
 * Bacalhau REST API types (subset) + federation types used by the dashboard.
 *
 * Privacy invariant (M1):
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
  name: 'no-genotypes-in-output' | 'counts-only' | 'size-bound';
  ok: boolean;
  detail?: string;
}

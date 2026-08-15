export type Health = {
  status: string;
  service: string;
  version: string;
  time: string;
  mock: boolean;
  openRouter?: {
    keyConfigured?: boolean;
    source?: string;
    mode?: string;
    defaultModel?: string | null;
    premiumModel?: string | null;
    allowPremiumModels?: boolean;
    activeModel?: string | null;
  };
};

export type CostSummary = {
  totalUsd: number;
  periodCostUsd: number;
  periodLedgerUsd?: number;
  periodTokens: number;
  periodEntries?: number;
  period?: string;
  entries: number;
  premiumCostUsd?: number;
  premiumEntries?: number;
  billedCostUsd?: number;
  billedEntries?: number;
  /** In-flight doctrine sessions (not yet ledger-committed). */
  liveTokens?: number;
  liveCostUsd?: number;
  liveSessions?: number;
  periodPlusLiveUsd?: number;
  byModel?: {
    model: string;
    costUsd: number;
    tokens: number;
    premium: boolean;
  }[];
};

/** Main operator console tabs — consolidated, no nested ops subtabs. */
export type OperatorTab =
  | "pulse"
  | "operations"
  | "control"
  | "catalog"
  | "pricing"
  | "merchants"
  | "automation"
  | "exports"
  | "debug"
  | "support"
  | "mail"
  | "users";

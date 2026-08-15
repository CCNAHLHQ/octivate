/** Client-side dashboard shapes for the minimal Automation UI. */

export type AutoSummary = {
  control: "idle" | "running" | "paused" | "cancelling";
  effectiveControl?: "idle" | "running" | "paused" | "cancelling" | "offline";
  workerLive?: boolean;
  workerPid?: number | null;
  found: number;
  held?: number;
  queued: number;
  downloading: number;
  downloaded?: number;
  transcribing: number;
  done: number;
  failed: number;
  active: number;
  jobs: number;
  seedsEnabled: number;
  lastError?: string;
};

export type AutoJob = {
  id: string;
  title: string;
  country: string;
  stage: string;
  progressPct: number;
  progressLabel?: string;
  hasTranscript?: boolean;
  error?: string;
  errorDetail?: string;
  mediaUrl?: string;
  model?: string | null;
  asrProvider?: string;
};

export type AutoSeed = {
  id: string;
  url: string;
  label: string;
  country: string;
  enabled: boolean;
};

export type AutoEvent = {
  id: string;
  at: string;
  level: string;
  message: string;
};

export type AutoSettings = {
  batchSize: number;
  asrProvider: "auto" | "openrouter" | "local";
};

export const JOBS_PAGE_SIZE = 8;

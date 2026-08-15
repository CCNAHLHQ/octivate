/** Client-side dashboard shapes for Automation UI. */

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
  bytesDownloaded?: number;
  bytesTotal?: number;
  bytesPerSec?: number;
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
  meta?: unknown;
  pid?: number;
};

export type AutoSettings = {
  batchSize: number;
  asrProvider: "auto" | "openrouter" | "local";
};

export const JOBS_PAGE_SIZE = 8;

export function formatRate(bps?: number | null): string {
  if (bps == null || !Number.isFinite(bps) || bps <= 0) return "—";
  const mbps = bps / 1e6;
  if (mbps >= 10) return `${mbps.toFixed(0)} MB/s`;
  if (mbps >= 0.1) return `${mbps.toFixed(2)} MB/s`;
  return `${(bps / 1e3).toFixed(0)} KB/s`;
}

export function formatBytes(n?: number | null): string {
  if (n == null || !Number.isFinite(n) || n < 0) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} KB`;
  return `${n} B`;
}

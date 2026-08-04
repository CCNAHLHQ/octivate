import { readObject, writeObject } from "@/lib/store/json-store";
import type { SourceProbeConfig } from "@/lib/types";

const STORE = "source-probe-config";

export const DEFAULT_SOURCE_PROBE_CONFIG: SourceProbeConfig = {
  enabled: true,
  intervalHours: 6,
  staleAfterHours: 12,
  concurrency: 3,
  /** Gov/CDN origins often need >8s; false timeouts read as Unavailable. */
  timeoutMs: 12000,
  perDomainGapMs: 1500,
  batchSize: 12,
  captureEnabled: false,
  captureMaxVersions: 5,
  captureMaxHtmlBytes: 1_500_000,
};

export function normalizeProbeConfig(
  raw?: Partial<SourceProbeConfig> | null
): SourceProbeConfig {
  const d = DEFAULT_SOURCE_PROBE_CONFIG;
  const n = { ...d, ...(raw || {}) };
  return {
    enabled: Boolean(n.enabled),
    intervalHours: Math.min(168, Math.max(1, Math.round(Number(n.intervalHours) || d.intervalHours))),
    staleAfterHours: Math.min(
      720,
      Math.max(1, Math.round(Number(n.staleAfterHours) || d.staleAfterHours))
    ),
    concurrency: Math.min(8, Math.max(1, Math.round(Number(n.concurrency) || d.concurrency))),
    timeoutMs: Math.min(30_000, Math.max(2_000, Math.round(Number(n.timeoutMs) || d.timeoutMs))),
    perDomainGapMs: Math.min(
      30_000,
      Math.max(250, Math.round(Number(n.perDomainGapMs) || d.perDomainGapMs))
    ),
    batchSize: Math.min(40, Math.max(1, Math.round(Number(n.batchSize) || d.batchSize))),
    captureEnabled: Boolean(n.captureEnabled),
    captureMaxVersions: Math.min(
      30,
      Math.max(1, Math.round(Number(n.captureMaxVersions) || d.captureMaxVersions))
    ),
    captureMaxHtmlBytes: Math.min(
      8_000_000,
      Math.max(50_000, Math.round(Number(n.captureMaxHtmlBytes) || d.captureMaxHtmlBytes))
    ),
  };
}

export async function readProbeConfig(): Promise<SourceProbeConfig> {
  const stored = await readObject<Partial<SourceProbeConfig>>(STORE, DEFAULT_SOURCE_PROBE_CONFIG);
  // One-time bump: legacy 8s default was too aggressive for gov/CDN origins.
  if (stored && stored.timeoutMs === 8000) {
    stored.timeoutMs = DEFAULT_SOURCE_PROBE_CONFIG.timeoutMs;
  }
  return normalizeProbeConfig(stored);
}

export async function writeProbeConfig(cfg: SourceProbeConfig): Promise<SourceProbeConfig> {
  const next = normalizeProbeConfig(cfg);
  await writeObject(STORE, next);
  return next;
}

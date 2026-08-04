import { uid } from "@/lib/store/json-store";
import { DEFAULT_USAGE } from "@/lib/mock/seed";
import {
  getAppConfig,
  hasCostForSession,
  insertCostLedger,
  listCostLedger,
  deleteCostLedger,
  readUsageRow,
  setAppConfig,
  writeUsageRow,
  resetOpsAccounting,
} from "@/lib/supabase/ops-db";
import { emitOpsEvent } from "@/lib/ops/event-log";
import type {
  AgentSession,
  CostChannel,
  CostEntry,
  OperatorLimits,
  UsageSnapshot,
} from "@/lib/types";

/** Reporting period key (YYYY-MM) for usage aggregation. */
export function currentPeriod(d: Date = new Date()): string {
  return d.toISOString().slice(0, 7);
}

async function readLimits(): Promise<OperatorLimits> {
  const { normalizeLimits } = await import("@/lib/auth/profile-limits");
  const stored = await getAppConfig<OperatorLimits>("limits");
  return normalizeLimits(stored);
}

async function operatorTokenLimit(): Promise<number> {
  const limits = await readLimits();
  return limits.tokensPerDay;
}

export function filterCostsForPeriod(costs: CostEntry[], period: string): CostEntry[] {
  return costs.filter((c) => typeof c.at === "string" && c.at.startsWith(period));
}

/** Ledger is the source of truth for tokens + USD in the period. */
export function aggregatePeriodFromLedger(
  costs: CostEntry[],
  period: string
): {
  tokensUsed: number;
  estimatedCostUsd: number;
  sessionsRun: number;
  periodEntries: number;
  billedCostUsd: number;
  premiumCostUsd: number;
} {
  const periodCosts = filterCostsForPeriod(costs, period);
  const tokensUsed = periodCosts.reduce((s, c) => s + (c.tokens || 0), 0);
  const estimatedCostUsd = Number(
    periodCosts.reduce((s, c) => s + (c.costUsd || 0), 0).toFixed(4)
  );
  const sessionIds = new Set(
    periodCosts
      .filter((c) => c.channel === "doctrine" && c.sessionId)
      .map((c) => c.sessionId as string)
  );
  const billedCostUsd = Number(
    periodCosts
      .filter((c) => c.costSource === "openrouter")
      .reduce((s, c) => s + (c.costUsd || 0), 0)
      .toFixed(4)
  );
  const premiumCostUsd = Number(
    periodCosts.filter((c) => c.premium).reduce((s, c) => s + (c.costUsd || 0), 0).toFixed(4)
  );
  return {
    tokensUsed,
    estimatedCostUsd,
    sessionsRun: sessionIds.size,
    periodEntries: periodCosts.length,
    billedCostUsd,
    premiumCostUsd,
  };
}

export async function publishAccountingTick(
  detail: string,
  meta?: Record<string, unknown>
): Promise<void> {
  await emitOpsEvent({
    level: "info",
    source: "pipeline",
    message: `accounting:${detail}`.slice(0, 2000),
    meta,
  });
}

/**
 * Rebuild period token/cost counters from the cost ledger (source of truth).
 * Preserves briefsGenerated unless explicitly overridden.
 */
export async function syncUsageFromLedger(opts?: {
  briefsGenerated?: number;
}): Promise<UsageSnapshot> {
  const tokensLimit = await operatorTokenLimit();
  const period = currentPeriod();
  const costs = await listCostLedger(2000);
  const agg = aggregatePeriodFromLedger(costs, period);
  const prev = (await readUsageRow(period)) || {
    ...DEFAULT_USAGE,
    period,
    tokensUsed: 0,
    estimatedCostUsd: 0,
    briefsGenerated: 0,
    sessionsRun: 0,
    tokensLimit,
  };

  const usage: UsageSnapshot = {
    period,
    tokensLimit,
    tokensUsed: agg.tokensUsed,
    estimatedCostUsd: agg.estimatedCostUsd,
    sessionsRun: agg.sessionsRun,
    briefsGenerated:
      typeof opts?.briefsGenerated === "number" ? opts.briefsGenerated : prev.briefsGenerated || 0,
  };
  await writeUsageRow(usage);
  return usage;
}

/**
 * Read the live usage snapshot — always re-syncs tokens/cost from ledger.
 */
export async function readUsage(): Promise<UsageSnapshot> {
  return syncUsageFromLedger();
}

/**
 * Record real work into the cost ledger, then rebuild the period snapshot from it.
 */
export async function recordUsage(opts: {
  tokens: number;
  cost: number;
  sessionId?: string;
  model: string;
  label: string;
  briefs?: number;
  countSession?: boolean;
  premium?: boolean;
  channel?: CostChannel;
  costSource?: CostEntry["costSource"];
  generationId?: string;
}): Promise<CostEntry | null> {
  const tokens = Math.max(0, Math.round(opts.tokens) || 0);
  const cost = Number((opts.cost || 0).toFixed(6));
  if (tokens <= 0 && cost <= 0) return null;

  const entry: CostEntry = {
    id: uid("cost"),
    at: new Date().toISOString(),
    model: opts.model,
    tokens,
    costUsd: Number(cost.toFixed(4)),
    sessionId: opts.sessionId || undefined,
    label: opts.label,
    premium: Boolean(opts.premium),
    channel: opts.channel || "other",
    costSource: opts.costSource || "estimate",
    generationId: opts.generationId,
  };
  await insertCostLedger(entry);

  const prev = await readUsageRow(currentPeriod());
  const briefsGenerated = (prev?.briefsGenerated || 0) + (opts.briefs ?? 0);
  const usage = await syncUsageFromLedger({ briefsGenerated });

  await publishAccountingTick("ledger_write", {
    entryId: entry.id,
    tokens: entry.tokens,
    costUsd: entry.costUsd,
    channel: entry.channel,
    sessionId: entry.sessionId,
    periodTokens: usage.tokensUsed,
    periodCostUsd: usage.estimatedCostUsd,
  });

  return entry;
}

export async function flushSessionUsage(
  session: AgentSession,
  label: string,
  opts?: { briefs?: number; countSession?: boolean }
): Promise<boolean> {
  if (session.usageRecorded) return false;
  if (!(session.tokensUsed > 0 || session.estimatedCostUsd > 0)) return false;

  if (await hasCostForSession(session.id)) {
    session.usageRecorded = true;
    return false;
  }

  await recordUsage({
    tokens: session.tokensUsed || 0,
    cost: session.estimatedCostUsd || 0,
    sessionId: session.id,
    model: session.modelUsed || "unknown",
    label,
    briefs: opts?.briefs,
    countSession: opts?.countSession,
    premium: Boolean(session.usedPremium),
    channel: "doctrine",
    costSource: session.costSource || "openrouter",
  });
  session.usageRecorded = true;
  return true;
}

export async function reverseUsageForCost(entry: CostEntry): Promise<void> {
  // Rebuild from ledger after delete — do not RMW snapshot counters.
  const prev = await readUsageRow(currentPeriod());
  await syncUsageFromLedger({ briefsGenerated: prev?.briefsGenerated || 0 });
  await publishAccountingTick("ledger_delete", {
    entryId: entry.id,
    tokens: entry.tokens,
    costUsd: entry.costUsd,
  });
}

export async function readCostLedger(): Promise<CostEntry[]> {
  return listCostLedger(500);
}

export async function removeCostLedgerEntry(id: string): Promise<CostEntry | null> {
  const removed = await deleteCostLedger(id);
  if (removed) await reverseUsageForCost(removed);
  return removed;
}

export function summarizeCostsByModel(costs: CostEntry[], limit = 8) {
  const map = new Map<string, { costUsd: number; tokens: number; premium: boolean }>();
  for (const c of costs) {
    const prev = map.get(c.model) || { costUsd: 0, tokens: 0, premium: false };
    prev.costUsd += c.costUsd || 0;
    prev.tokens += c.tokens || 0;
    prev.premium = prev.premium || Boolean(c.premium);
    map.set(c.model, prev);
  }
  return [...map.entries()]
    .map(([model, v]) => ({
      model,
      costUsd: Number(v.costUsd.toFixed(4)),
      tokens: v.tokens,
      premium: v.premium,
    }))
    .sort((a, b) => b.costUsd - a.costUsd || b.tokens - a.tokens)
    .slice(0, limit);
}

export async function readOperatorLimits(): Promise<OperatorLimits> {
  return readLimits();
}

export async function writeOperatorLimits(limits: OperatorLimits): Promise<void> {
  await setAppConfig("limits", limits);
}

/** Wipe Supabase ledger + usage snapshots (fresh baseline). */
export async function resetAccountingStats(): Promise<{
  deletedCosts: number;
  period: string;
}> {
  const result = await resetOpsAccounting();
  await publishAccountingTick("reset", { deletedCosts: result.deletedCosts, period: result.period });
  return result;
}

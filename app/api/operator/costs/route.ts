import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { assertAllowedOrigin } from "@/lib/security/origin";
import { appendAudit } from "@/lib/protocol/audit";
import {
  aggregatePeriodFromLedger,
  filterCostsForPeriod,
  readCostLedger,
  readUsage,
  resetAccountingStats,
  summarizeCostsByModel,
} from "@/lib/usage/usage-store";
import { listSessions } from "@/lib/agents/session-store";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;

  const [costs, usage, sessions] = await Promise.all([
    readCostLedger(),
    readUsage(),
    listSessions(),
  ]);

  const periodCosts = filterCostsForPeriod(costs, usage.period);
  const agg = aggregatePeriodFromLedger(costs, usage.period);
  const totalUsd = costs.reduce((sum, c) => sum + c.costUsd, 0);

  const liveSessions = sessions.filter(
    (s) => s.status === "running" || s.status === "pending"
  );
  const liveTokens = liveSessions.reduce((s, x) => s + (x.tokensUsed || 0), 0);
  const liveCostUsd = Number(
    liveSessions.reduce((s, x) => s + (x.estimatedCostUsd || 0), 0).toFixed(4)
  );

  // Ledger is authoritative for committed period cost (fixes snapshot drift).
  const periodCostUsd = agg.estimatedCostUsd;

  return jsonOk({
    costs,
    periodCosts,
    summary: {
      totalUsd: Number(totalUsd.toFixed(4)),
      entries: costs.length,
      period: usage.period,
      periodTokens: agg.tokensUsed,
      periodCostUsd,
      periodLedgerUsd: periodCostUsd,
      periodEntries: agg.periodEntries,
      premiumCostUsd: agg.premiumCostUsd,
      premiumEntries: periodCosts.filter((c) => c.premium).length,
      billedCostUsd: agg.billedCostUsd,
      billedEntries: periodCosts.filter((c) => c.costSource === "openrouter").length,
      byModel: summarizeCostsByModel(periodCosts),
      liveTokens,
      liveCostUsd,
      liveSessions: liveSessions.length,
      /** Committed period + in-flight session spend (display helper). */
      periodPlusLiveUsd: Number((periodCostUsd + liveCostUsd).toFixed(4)),
    },
  });
}

/** Clear cost ledger + usage snapshots (fresh accounting baseline). */
export async function DELETE(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const originDenied = assertAllowedOrigin(req);
  if (originDenied) return originDenied;

  try {
    const result = await resetAccountingStats();
    await appendAudit({
      action: "ops_accounting_reset",
      detail: `deleted ${result.deletedCosts} ledger row(s) · period ${result.period}`,
    });
    const usage = await readUsage();
    return jsonOk({
      ok: true,
      deletedCosts: result.deletedCosts,
      period: result.period,
      usage,
      costs: [],
      summary: {
        totalUsd: 0,
        entries: 0,
        period: result.period,
        periodTokens: 0,
        periodCostUsd: 0,
        periodLedgerUsd: 0,
        periodEntries: 0,
        premiumCostUsd: 0,
        premiumEntries: 0,
        billedCostUsd: 0,
        billedEntries: 0,
        byModel: [],
        liveTokens: 0,
        liveCostUsd: 0,
        liveSessions: 0,
        periodPlusLiveUsd: 0,
      },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Accounting reset failed", 500);
  }
}

import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase/admin";
import type { AgentSession, CostChannel, CostEntry, UsageSnapshot } from "@/lib/types";

export function requireOpsDb() {
  if (!supabaseConfigured()) {
    throw new Error("Supabase is not configured — ops data requires SUPABASE_* env vars");
  }
  const client = getSupabaseAdmin();
  if (!client) throw new Error("Supabase admin client unavailable");
  return client;
}

type AppConfigRow = { key: string; value: unknown; updated_at?: string };
type UsageRow = {
  period: string;
  tokens_used: number;
  tokens_limit: number;
  estimated_cost_usd: number | string;
  briefs_generated: number;
  sessions_run: number;
};
type CostRow = {
  id: string;
  at: string;
  model: string;
  tokens: number;
  cost_usd: number | string;
  session_id: string | null;
  label: string;
  premium: boolean;
  channel: string;
  cost_source?: string | null;
  generation_id?: string | null;
};
type SessionRow = {
  id: string;
  project_id: string;
  status: string;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
  tokens_used: number;
  estimated_cost_usd: number | string;
  model_used: string | null;
  used_premium: boolean;
  usage_recorded: boolean;
  payload: AgentSession;
};

function num(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function getAppConfig<T>(key: string): Promise<T | null> {
  const db = requireOpsDb();
  const { data, error } = await db.from("app_config").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(`app_config read failed: ${error.message}`);
  return (data as AppConfigRow | null)?.value as T | null;
}

export async function setAppConfig(key: string, value: unknown): Promise<void> {
  const db = requireOpsDb();
  const { error } = await db.from("app_config").upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );
  if (error) throw new Error(`app_config write failed: ${error.message}`);
}

export async function readUsageRow(period: string): Promise<UsageSnapshot | null> {
  const db = requireOpsDb();
  const { data, error } = await db
    .from("usage_snapshots")
    .select("*")
    .eq("period", period)
    .maybeSingle();
  if (error) throw new Error(`usage_snapshots read failed: ${error.message}`);
  if (!data) return null;
  const row = data as UsageRow;
  return {
    period: row.period,
    tokensUsed: Number(row.tokens_used) || 0,
    tokensLimit: Number(row.tokens_limit) || 0,
    estimatedCostUsd: num(row.estimated_cost_usd),
    briefsGenerated: Number(row.briefs_generated) || 0,
    sessionsRun: Number(row.sessions_run) || 0,
  };
}

export async function writeUsageRow(usage: UsageSnapshot): Promise<void> {
  const db = requireOpsDb();
  const { error } = await db.from("usage_snapshots").upsert(
    {
      period: usage.period,
      tokens_used: usage.tokensUsed,
      tokens_limit: usage.tokensLimit,
      estimated_cost_usd: usage.estimatedCostUsd,
      briefs_generated: usage.briefsGenerated,
      sessions_run: usage.sessionsRun,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "period" }
  );
  if (error) throw new Error(`usage_snapshots write failed: ${error.message}`);
}

function mapCost(row: CostRow): CostEntry {
  return {
    id: row.id,
    at: row.at,
    model: row.model,
    tokens: Number(row.tokens) || 0,
    costUsd: num(row.cost_usd),
    sessionId: row.session_id || undefined,
    label: row.label,
    premium: Boolean(row.premium),
    channel: (row.channel as CostChannel) || "other",
    costSource:
      row.cost_source === "openrouter" ||
      row.cost_source === "estimate" ||
      row.cost_source === "mixed"
        ? row.cost_source
        : undefined,
    generationId: row.generation_id || undefined,
  };
}

export async function listCostLedger(limit = 500): Promise<CostEntry[]> {
  const db = requireOpsDb();
  const { data, error } = await db
    .from("cost_ledger")
    .select("*")
    .order("at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`cost_ledger list failed: ${error.message}`);
  return ((data || []) as CostRow[]).map(mapCost);
}

export async function insertCostLedger(entry: CostEntry): Promise<void> {
  const db = requireOpsDb();
  const { error } = await db.from("cost_ledger").upsert(
    {
      id: entry.id,
      at: entry.at,
      model: entry.model,
      tokens: entry.tokens,
      cost_usd: entry.costUsd,
      session_id: entry.sessionId || null,
      label: entry.label,
      premium: Boolean(entry.premium),
      channel: entry.channel || "other",
      cost_source: entry.costSource || "estimate",
      generation_id: entry.generationId || null,
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`cost_ledger insert failed: ${error.message}`);
}

/** Wipe cost ledger + period usage counters (fresh accounting baseline). */
export async function resetOpsAccounting(): Promise<{
  deletedCosts: number;
  period: string;
}> {
  const db = requireOpsDb();
  const period = new Date().toISOString().slice(0, 7);

  const { count: beforeCount, error: countErr } = await db
    .from("cost_ledger")
    .select("id", { count: "exact", head: true });
  if (countErr) throw new Error(`cost_ledger reset count failed: ${countErr.message}`);

  // Unconditional delete — avoid .in(id) batch limits / partial deletes.
  const { error: delErr } = await db
    .from("cost_ledger")
    .delete()
    .gte("at", "1970-01-01T00:00:00.000Z");
  if (delErr) throw new Error(`cost_ledger reset delete failed: ${delErr.message}`);

  const { count: afterCount, error: afterErr } = await db
    .from("cost_ledger")
    .select("id", { count: "exact", head: true });
  if (afterErr) throw new Error(`cost_ledger reset verify failed: ${afterErr.message}`);
  if ((afterCount || 0) > 0) {
    throw new Error(`cost_ledger reset incomplete — ${afterCount} row(s) remain`);
  }

  const { data: lim } = await db.from("app_config").select("value").eq("key", "limits").maybeSingle();
  const tokensLimit =
    lim && typeof lim.value === "object" && lim.value && "tokensPerDay" in (lim.value as object)
      ? Number((lim.value as { tokensPerDay?: number }).tokensPerDay) || 0
      : 0;

  // Wipe every usage snapshot, then write a clean current period.
  const { error: wipeUsageErr } = await db
    .from("usage_snapshots")
    .delete()
    .gte("period", "1970-01");
  if (wipeUsageErr) throw new Error(`usage wipe failed: ${wipeUsageErr.message}`);

  const { error: usageErr } = await db.from("usage_snapshots").upsert(
    {
      period,
      tokens_used: 0,
      tokens_limit: tokensLimit,
      estimated_cost_usd: 0,
      briefs_generated: 0,
      sessions_run: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "period" }
  );
  if (usageErr) throw new Error(`usage reset failed: ${usageErr.message}`);

  return { deletedCosts: beforeCount || 0, period };
}

export async function deleteCostLedger(id: string): Promise<CostEntry | null> {
  const db = requireOpsDb();
  const { data, error } = await db.from("cost_ledger").delete().eq("id", id).select("*").maybeSingle();
  if (error) throw new Error(`cost_ledger delete failed: ${error.message}`);
  return data ? mapCost(data as CostRow) : null;
}

export async function hasCostForSession(sessionId: string): Promise<boolean> {
  const db = requireOpsDb();
  const { data, error } = await db
    .from("cost_ledger")
    .select("id")
    .eq("session_id", sessionId)
    .limit(1);
  if (error) throw new Error(`cost_ledger session check failed: ${error.message}`);
  return Boolean(data?.length);
}

function sessionToRow(session: AgentSession): SessionRow {
  return {
    id: session.id,
    project_id: session.projectId,
    status: session.status,
    started_at: session.startedAt,
    updated_at: session.updatedAt || session.startedAt,
    completed_at: session.completedAt || null,
    tokens_used: session.tokensUsed || 0,
    estimated_cost_usd: session.estimatedCostUsd || 0,
    model_used: session.modelUsed || null,
    used_premium: Boolean(session.usedPremium),
    usage_recorded: Boolean(session.usageRecorded),
    payload: session,
  };
}

function rowToSession(row: SessionRow): AgentSession {
  const payload = (row.payload || {}) as AgentSession;
  return {
    ...payload,
    id: row.id,
    projectId: row.project_id || payload.projectId,
    status: (row.status as AgentSession["status"]) || payload.status,
    startedAt: row.started_at || payload.startedAt,
    updatedAt: row.updated_at || payload.updatedAt,
    completedAt: row.completed_at || payload.completedAt,
    tokensUsed: Number(row.tokens_used) || payload.tokensUsed || 0,
    estimatedCostUsd: num(row.estimated_cost_usd) || payload.estimatedCostUsd || 0,
    modelUsed: row.model_used || payload.modelUsed,
    usedPremium: row.used_premium ?? payload.usedPremium,
    usageRecorded: row.usage_recorded ?? payload.usageRecorded,
  };
}

export async function upsertAgentSession(session: AgentSession): Promise<void> {
  const db = requireOpsDb();
  const { error } = await db.from("agent_sessions").upsert(sessionToRow(session), {
    onConflict: "id",
  });
  if (error) throw new Error(`agent_sessions upsert failed: ${error.message}`);
}

export async function getAgentSessionRow(id: string): Promise<AgentSession | null> {
  const db = requireOpsDb();
  const { data, error } = await db.from("agent_sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`agent_sessions read failed: ${error.message}`);
  return data ? rowToSession(data as SessionRow) : null;
}

export async function listAgentSessionRows(limit = 100): Promise<AgentSession[]> {
  const db = requireOpsDb();
  const { data, error } = await db
    .from("agent_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`agent_sessions list failed: ${error.message}`);
  return ((data || []) as SessionRow[]).map(rowToSession);
}

export async function deleteAgentSessionRow(id: string): Promise<AgentSession | null> {
  const db = requireOpsDb();
  const { data, error } = await db
    .from("agent_sessions")
    .delete()
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`agent_sessions delete failed: ${error.message}`);
  return data ? rowToSession(data as SessionRow) : null;
}

/** Delete every agent session row (operator clear-all). */
export async function clearAllAgentSessionRows(): Promise<number> {
  const db = requireOpsDb();
  const { count: beforeCount, error: countErr } = await db
    .from("agent_sessions")
    .select("id", { count: "exact", head: true });
  if (countErr) throw new Error(`agent_sessions clear count failed: ${countErr.message}`);
  if (!(beforeCount || 0)) return 0;

  const { error: delErr } = await db
    .from("agent_sessions")
    .delete()
    .gte("started_at", "1970-01-01T00:00:00.000Z");
  if (delErr) throw new Error(`agent_sessions clear failed: ${delErr.message}`);

  const { count: afterCount, error: afterErr } = await db
    .from("agent_sessions")
    .select("id", { count: "exact", head: true });
  if (afterErr) throw new Error(`agent_sessions clear verify failed: ${afterErr.message}`);
  if ((afterCount || 0) > 0) {
    throw new Error(`agent_sessions clear incomplete — ${afterCount} row(s) remain`);
  }
  return beforeCount || 0;
}

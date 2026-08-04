/**
 * Apply ops schema to Supabase and migrate local JSON
 * (model-config, limits, usage, costs, agent-sessions) off disk.
 *
 * Usage: node --env-file=.env scripts/supabase-migrate-ops.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";

const ROOT = process.cwd();
const LOCAL = path.join(ROOT, "data", "local");
const MIGRATION = path.join(
  ROOT,
  "supabase",
  "migrations",
  "20260730_ops_config_costs.sql"
);
const ARCHIVE = path.join(LOCAL, "_archived_ops");

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function runSql(query) {
  const token = requireEnv("SUPABASE_ACCESS_TOKEN");
  const ref = requireEnv("SUPABASE_PROJECT_REF");
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text}`);
  return text;
}

async function readJson(name, fallback) {
  try {
    const raw = await fs.readFile(path.join(LOCAL, `${name}.json`), "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function archiveLocal(name) {
  await fs.mkdir(ARCHIVE, { recursive: true });
  const src = path.join(LOCAL, `${name}.json`);
  const dest = path.join(ARCHIVE, `${name}.${Date.now()}.json`);
  try {
    await fs.rename(src, dest);
    console.log(`archived ${name}.json → ${path.relative(ROOT, dest)}`);
  } catch (err) {
    if (err && err.code !== "ENOENT") throw err;
    console.log(`skip archive ${name}.json (missing)`);
  }
}

async function main() {
  const url = requireEnv("SUPABASE_URL");
  const service = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Applying schema…");
  const sql = await fs.readFile(MIGRATION, "utf8");
  await runSql(sql);
  await runSql("notify pgrst, 'reload schema'");
  console.log("Schema ready.");

  const modelConfig = await readJson("model-config", null);
  const limits = await readJson("limits", null);
  const usage = await readJson("usage", null);
  const costs = await readJson("costs", []);
  const sessions = await readJson("agent-sessions", []);

  // Expand allowlist with DeepSeek + Kimi if migrating an older config.
  if (modelConfig && Array.isArray(modelConfig.allowlist)) {
    const extra = [
      "deepseek/deepseek-v4-flash",
      "deepseek/deepseek-v4-pro",
      "deepseek/deepseek-chat",
      "deepseek/deepseek-v3.2",
      "deepseek/deepseek-v3.2-exp",
      "deepseek/deepseek-chat-v3.1",
      "deepseek/deepseek-v3.1-terminus",
      "deepseek/deepseek-chat-v3-0324",
      "deepseek/deepseek-r1",
      "deepseek/deepseek-r1-0528",
      "deepseek/deepseek-r1-distill-llama-70b",
      "moonshotai/kimi-k3",
      "moonshotai/kimi-k2.7-code",
      "moonshotai/kimi-k2.6",
      "moonshotai/kimi-k2.5",
      "moonshotai/kimi-k2-thinking",
      "moonshotai/kimi-k2-0905",
      "moonshotai/kimi-k2",
      "~moonshotai/kimi-latest",
    ];
    modelConfig.allowlist = Array.from(new Set([...modelConfig.allowlist, ...extra]));
  }

  if (modelConfig) {
    const { error } = await db.from("app_config").upsert(
      { key: "model-config", value: modelConfig, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    if (error) throw error;
    console.log("migrated model-config");
  }

  if (limits) {
    const { error } = await db.from("app_config").upsert(
      { key: "limits", value: limits, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    if (error) throw error;
    console.log("migrated limits");
  }

  if (usage?.period) {
    const { error } = await db.from("usage_snapshots").upsert(
      {
        period: usage.period,
        tokens_used: usage.tokensUsed || 0,
        tokens_limit: usage.tokensLimit || 0,
        estimated_cost_usd: usage.estimatedCostUsd || 0,
        briefs_generated: usage.briefsGenerated || 0,
        sessions_run: usage.sessionsRun || 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "period" }
    );
    if (error) throw error;
    console.log(`migrated usage period ${usage.period}`);
  }

  if (Array.isArray(costs) && costs.length) {
    const rows = costs.map((c) => ({
      id: c.id,
      at: c.at,
      model: c.model,
      tokens: c.tokens || 0,
      cost_usd: c.costUsd || 0,
      session_id: c.sessionId || null,
      label: c.label || c.model,
      premium: Boolean(c.premium),
      channel: c.channel || "other",
    }));
    const { error } = await db.from("cost_ledger").upsert(rows, { onConflict: "id" });
    if (error) throw error;
    console.log(`migrated ${rows.length} cost ledger rows`);
  }

  if (Array.isArray(sessions) && sessions.length) {
    const rows = sessions.map((s) => ({
      id: s.id,
      project_id: s.projectId,
      status: s.status,
      started_at: s.startedAt,
      updated_at: s.updatedAt || s.startedAt,
      completed_at: s.completedAt || null,
      tokens_used: s.tokensUsed || 0,
      estimated_cost_usd: s.estimatedCostUsd || 0,
      model_used: s.modelUsed || null,
      used_premium: Boolean(s.usedPremium),
      usage_recorded: Boolean(s.usageRecorded),
      payload: s,
    }));
    const { error } = await db.from("agent_sessions").upsert(rows, { onConflict: "id" });
    if (error) throw error;
    console.log(`migrated ${rows.length} agent sessions`);
  }

  for (const name of ["model-config", "limits", "usage", "costs", "agent-sessions"]) {
    await archiveLocal(name);
  }

  console.log("Done. Ops config/stats/costs now live in Supabase.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

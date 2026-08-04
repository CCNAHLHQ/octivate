/**
 * Apply cost_source columns and wipe historical ledger/usage for a clean baseline.
 * Usage: node --env-file=.env scripts/supabase-reset-ops-costs.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";

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

async function main() {
  const sqlPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260730_cost_source.sql"
  );
  console.log("Applying cost_source columns…");
  await runSql(await fs.readFile(sqlPath, "utf8"));
  await runSql("notify pgrst, 'reload schema'");

  const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: costs, error: listErr } = await db.from("cost_ledger").select("id");
  if (listErr) throw listErr;
  const ids = (costs || []).map((c) => c.id);
  if (ids.length) {
    const { error } = await db.from("cost_ledger").delete().in("id", ids);
    if (error) throw error;
  }
  console.log(`Cleared ${ids.length} cost ledger rows`);

  const period = new Date().toISOString().slice(0, 7);
  const { data: lim } = await db.from("app_config").select("value").eq("key", "limits").maybeSingle();
  const tokensLimit =
    lim && typeof lim.value === "object" && lim.value && "tokensPerDay" in lim.value
      ? Number(lim.value.tokensPerDay) || 0
      : 0;

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
  if (usageErr) throw usageErr;

  const { error: oldErr } = await db.from("usage_snapshots").delete().neq("period", period);
  if (oldErr) throw oldErr;

  console.log(`Reset usage snapshot for ${period} (tokens=0, cost=$0)`);
  console.log("Done. New spend will use OpenRouter billed usage.cost when present.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

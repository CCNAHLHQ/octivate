import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { requireOperatorUser, resolveRequestUser } from "@/lib/auth/scope";
import { appendAudit } from "@/lib/protocol/audit";
import { assertSafePublicUrl } from "@/lib/security/ssrf";
import { parlLog } from "@/lib/parliamentary/log";
import { isObsoleteSourceUrl } from "@/lib/parliamentary/sources";
import {
  readSeeds,
  removeSeed,
  resetVerifiedSources,
  upsertSeed,
} from "@/lib/parliamentary/store";
import type { CountryCode, CrawlSeed } from "@/lib/parliamentary/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COUNTRIES = new Set<CountryCode>(["BB", "TT", "GY", "JM"]);

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);
  return jsonOk({ seeds: await readSeeds() });
}

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  let body: Partial<CrawlSeed> & { url?: string; action?: string };
  try {
    body = (await req.json()) as Partial<CrawlSeed> & { url?: string; action?: string };
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  if (body.action === "reset_verified") {
    const seeds = await resetVerifiedSources();
    parlLog("info", "sources reset to verified set", { count: seeds.length });
    await appendAudit({
      action: "automation_sources_reset",
      detail: `Reset to ${seeds.length} verified BB/GY Vimeo sources`,
    });
    return jsonOk({ seeds });
  }

  if (!body.url?.trim()) return jsonError("url required", 400);
  if (isObsoleteSourceUrl(body.url)) {
    return jsonError(
      "That site is YouTube-primary or obsolete for Vimeo ingest. Use Barbados Vimeo showcase or Guyana sitting pages.",
      400
    );
  }
  const safe = await assertSafePublicUrl(body.url);
  if (!safe.ok) return jsonError(safe.detail || "URL blocked", 400);
  if (body.country && !COUNTRIES.has(body.country as CountryCode)) {
    return jsonError("country must be BB|TT|GY|JM", 400);
  }

  try {
    const seed = await upsertSeed({
      id: body.id,
      url: body.url,
      label: body.label,
      country: body.country as CountryCode | undefined,
      enabled: body.enabled,
      kind: body.kind,
      notes: body.notes,
    });
    parlLog("info", "seed upsert", { id: seed.id, url: seed.url });
    await appendAudit({
      action: "automation_seed_upsert",
      detail: `${seed.enabled ? "On" : "Off"} · ${seed.url} · ${seed.kind}`,
    });
    return jsonOk({ seed });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "seed_failed", 400);
  }
}

export async function DELETE(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) return jsonError("id required", 400);
  if (!(await removeSeed(id))) return jsonError("Seed not found", 404);
  await appendAudit({ action: "automation_seed_remove", detail: `Removed ${id}` });
  return jsonOk({ ok: true });
}

import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { requireOperatorUser, resolveRequestUser } from "@/lib/auth/scope";
import { batchHardCap } from "@/lib/parliamentary/config";
import { readSettings, writeSettings } from "@/lib/parliamentary/settings";
import { parlLog } from "@/lib/parliamentary/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);
  const settings = await readSettings();
  return jsonOk({ settings, hardCap: batchHardCap() });
}

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  let body: { batchSize?: number; maxRetries?: number; asrProvider?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const settings = await writeSettings({
    batchSize: body.batchSize,
    maxRetries: body.maxRetries,
    asrProvider: body.asrProvider as "auto" | "openrouter" | "local" | undefined,
  });
  parlLog("info", "settings updated", {
    by: gate.user.email || gate.user.id,
    batchSize: settings.batchSize,
    maxRetries: settings.maxRetries,
    asrProvider: settings.asrProvider,
  });
  return jsonOk({ settings, hardCap: batchHardCap() });
}

import { NextRequest } from "next/server";
import { requireOperatorUser, resolveRequestUser } from "@/lib/auth/scope";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { getI18nStatus, syncI18nCatalogs } from "@/lib/i18n/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true, progress: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  const status = await getI18nStatus();
  return jsonOk(status);
}

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  let locales: string[] | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as { locales?: string[] };
    if (Array.isArray(body.locales)) locales = body.locales.map(String);
  } catch {
    /* empty body ok */
  }

  const result = await syncI18nCatalogs({ locales });
  if (result.locked) return jsonError("Translation sync already running", 409);
  return jsonOk(result);
}

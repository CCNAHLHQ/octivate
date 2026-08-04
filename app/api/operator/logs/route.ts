import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import {
  clearOpsEvents,
  listOpsEvents,
  type OpsEventLevel,
  type OpsEventSource,
} from "@/lib/ops/event-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;

  const source = req.nextUrl.searchParams.get("source") as OpsEventSource | null;
  const level = req.nextUrl.searchParams.get("level") as OpsEventLevel | null;
  const before = req.nextUrl.searchParams.get("before") || undefined;
  const limit = Number(req.nextUrl.searchParams.get("limit") || "100");

  const events = await listOpsEvents({
    source: source || undefined,
    level: level || undefined,
    before,
    limit: Number.isFinite(limit) ? limit : 100,
  });
  return jsonOk({ events });
}

export async function DELETE(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  try {
    const cleared = await clearOpsEvents();
    return jsonOk({ cleared });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Clear failed", 500);
  }
}

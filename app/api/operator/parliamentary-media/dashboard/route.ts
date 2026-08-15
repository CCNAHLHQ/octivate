import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { requireOperatorUser, resolveRequestUser } from "@/lib/auth/scope";
import { parlEnabled } from "@/lib/parliamentary/config";
import { loadAutomationDashboard } from "@/lib/parliamentary/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Single Automation dashboard payload — reconciled control + stable jobs list.
 * Prefer this over fan-out summary/jobs/events/settings fetches.
 */
export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  if (!parlEnabled()) {
    return jsonOk({
      enabled: false,
      dashboard: null,
    });
  }

  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") || 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(req.nextUrl.searchParams.get("pageSize") || 10) || 10)
  );

  try {
    const dashboard = await loadAutomationDashboard({ page, pageSize, eventLimit: 80 });
    return jsonOk({ enabled: true, dashboard });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Dashboard failed", 500);
  }
}

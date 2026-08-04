import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { assertAllowedOrigin } from "@/lib/security/origin";
import { listSessions, recoverStaleSessions } from "@/lib/agents/orchestrator";
import { clearAllSessions } from "@/lib/agents/session-store";
import { appendAudit } from "@/lib/protocol/audit";

export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  // Heal abandoned "running" rows so the project page can unlock Rerun.
  await recoverStaleSessions();
  const projectId = req.nextUrl.searchParams.get("projectId");
  const sessions = await listSessions();
  const filtered = projectId
    ? sessions.filter((s) => s.projectId === projectId)
    : sessions;
  return jsonOk({ sessions: filtered });
}

/** Operator clear-all — wipe every agent session (Supabase + memory). */
export async function DELETE(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const originDenied = assertAllowedOrigin(req);
  if (originDenied) return originDenied;

  try {
    const cleared = await clearAllSessions();
    await appendAudit({
      action: "ops_sessions_cleared",
      detail: `cleared ${cleared} session(s)`,
    });
    return jsonOk({ ok: true, cleared, sessions: [] });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Clear sessions failed", 500);
  }
}

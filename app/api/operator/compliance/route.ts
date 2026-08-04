import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { getSession } from "@/lib/agents/orchestrator";
import { runComplianceChecks } from "@/lib/protocol/compliance";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;

  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return jsonError("sessionId required");

  const session = await getSession(sessionId);
  if (!session) return jsonError("Session not found", 404);

  const checks = runComplianceChecks(session);
  const passed = checks.filter((c) => c.passed).length;

  return jsonOk({
    sessionId,
    checks,
    summary: { passed, total: checks.length },
  });
}

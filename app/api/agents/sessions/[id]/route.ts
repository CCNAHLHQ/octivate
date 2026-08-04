import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { getSession } from "@/lib/agents/orchestrator";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req);
  if (denied) return denied;
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return jsonError("Session not found", 404);
  return jsonOk({ session });
}

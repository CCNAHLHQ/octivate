import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { requireOperatorUser, resolveRequestUser } from "@/lib/auth/scope";
import { getSummary } from "@/lib/parliamentary/store";
import { parlEnabled } from "@/lib/parliamentary/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  if (!parlEnabled()) {
    return jsonOk({
      enabled: false,
      summary: {
        control: "idle",
        found: 0,
        queued: 0,
        downloading: 0,
        transcribing: 0,
        done: 0,
        failed: 0,
        cancelled: 0,
        active: 0,
        jobs: 0,
        seedsEnabled: 0,
        seedsTotal: 0,
        estimateAsrSec: 0,
        discoverDone: false,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  const summary = await getSummary();
  return jsonOk({ enabled: true, summary });
}

import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { listPublicFounders } from "@/lib/support/public-founders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public Team page founders + live staff avatar URLs. */
export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;

  try {
    const founders = await listPublicFounders();
    return jsonOk({
      founders,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Founders unavailable";
    return jsonError(message, 500);
  }
}

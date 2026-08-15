import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { readLiveSources } from "@/lib/sources/live-registry";
import { clearAllSources } from "@/lib/sources/clear-registry";

export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  const result = await readLiveSources();
  return jsonOk({
    sources: result.sources,
    count: result.sources.length,
    droppedInvalid: result.droppedInvalid,
  });
}

/** DELETE /api/sources — wipe the entire live source registry. */
export async function DELETE(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  try {
    const result = await clearAllSources();
    return jsonOk({ ok: true, ...result });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to clear sources", 500);
  }
}

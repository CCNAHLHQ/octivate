import { NextRequest } from "next/server";
import { guardApi, jsonCached, jsonError, jsonOk } from "@/lib/security/guard";
import { clearAllSources } from "@/lib/sources/clear-registry";
import { readCollection } from "@/lib/store/json-store";
import { SEED_SOURCES } from "@/lib/mock/seed";
import type { Source } from "@/lib/types";

export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  const sources = await readCollection<Source>("sources", SEED_SOURCES);
  const sorted = [...sources].sort(
    (a, b) => (b.totalSourceScore ?? 0) - (a.totalSourceScore ?? 0) || a.title.localeCompare(b.title)
  );
  return jsonCached({ sources: sorted, count: sorted.length });
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

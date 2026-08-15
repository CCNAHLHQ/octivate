import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { appendAudit } from "@/lib/protocol/audit";
import { writeCollection } from "@/lib/store/json-store";
import { SEED_SOURCES } from "@/lib/mock/seed";
import type { Source } from "@/lib/types";

/** POST /api/sources/rehydrate — restore SEED_SOURCES into the live registry. */
export async function POST(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  try {
    const seeds = SEED_SOURCES.map((s) => ({ ...s }));
    await writeCollection<Source>("sources", seeds);
    await appendAudit({
      action: "sources_registry_rehydrated",
      detail: `Restored ${seeds.length} seed source(s)`,
    });
    return jsonOk({ ok: true, count: seeds.length, sources: seeds });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to rehydrate sources", 500);
  }
}

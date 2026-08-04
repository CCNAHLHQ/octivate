import { appendAudit } from "@/lib/protocol/audit";
import { writeCollection } from "@/lib/store/json-store";
import type { Source } from "@/lib/types";

/** Wipe the live source registry. Writes [] so SEED_SOURCES does not rehydrate. */
export async function clearAllSources(opts?: {
  sessionId?: string;
  detail?: string;
}): Promise<{ deleted: number }> {
  const { readCollection } = await import("@/lib/store/json-store");
  const { SEED_SOURCES } = await import("@/lib/mock/seed");
  const existing = await readCollection<Source>("sources", SEED_SOURCES);
  const deleted = existing.length;
  await writeCollection<Source>("sources", []);
  await appendAudit({
    action: "sources_registry_cleared",
    sessionId: opts?.sessionId,
    detail: opts?.detail || `Deleted all ${deleted} source(s) from the live registry`,
  });
  return { deleted };
}

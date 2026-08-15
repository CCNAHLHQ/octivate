import { appendAudit } from "@/lib/protocol/audit";
import { writeCollection } from "@/lib/store/json-store";
import { readSourcesCollection } from "@/lib/sources/live-registry";
import type { Source } from "@/lib/types";

/** Wipe the live source registry. Persists [] — no seed rehydrate. */
export async function clearAllSources(opts?: {
  sessionId?: string;
  detail?: string;
}): Promise<{ deleted: number }> {
  const existing = await readSourcesCollection();
  const deleted = existing.length;
  await writeCollection<Source>("sources", []);
  await appendAudit({
    action: "sources_registry_cleared",
    sessionId: opts?.sessionId,
    detail: opts?.detail || `Deleted all ${deleted} source(s) from the live registry`,
  });
  return { deleted };
}

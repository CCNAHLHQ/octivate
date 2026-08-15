import { SEED_SOURCES } from "@/lib/mock/seed";
import { readCollection, writeCollection } from "@/lib/store/json-store";
import type { Source } from "@/lib/types";

function isValidSource(s: unknown): s is Source {
  if (!s || typeof s !== "object") return false;
  const row = s as Partial<Source>;
  if (!row.id || typeof row.id !== "string") return false;
  if (!row.title || typeof row.title !== "string" || !row.title.trim()) return false;
  return true;
}

/**
 * Load the live source registry:
 * - drop corrupt / incomplete rows (no id/title)
 * - if the on-disk file is empty, restore SEED_SOURCES so the operator
 *   dashboard never flickers empty while seeds still exist in code
 */
export async function readLiveSources(opts?: {
  autoRehydrateEmpty?: boolean;
}): Promise<{
  sources: Source[];
  rehydrated: boolean;
  droppedInvalid: number;
}> {
  const raw = await readCollection<Source>("sources", SEED_SOURCES);
  const valid = raw.filter(isValidSource);
  const droppedInvalid = raw.length - valid.length;

  if (valid.length === 0 && opts?.autoRehydrateEmpty !== false) {
    const seeds = SEED_SOURCES.filter(isValidSource);
    await writeCollection("sources", seeds);
    return {
      sources: [...seeds].sort(
        (a, b) =>
          (b.totalSourceScore ?? 0) - (a.totalSourceScore ?? 0) ||
          a.title.localeCompare(b.title)
      ),
      rehydrated: true,
      droppedInvalid,
    };
  }

  if (droppedInvalid > 0) {
    await writeCollection("sources", valid);
  }

  const sources = [...valid].sort(
    (a, b) =>
      (b.totalSourceScore ?? 0) - (a.totalSourceScore ?? 0) ||
      a.title.localeCompare(b.title)
  );
  return { sources, rehydrated: false, droppedInvalid };
}

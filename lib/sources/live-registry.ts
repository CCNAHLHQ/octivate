import { readCollection, writeCollection } from "@/lib/store/json-store";
import type { Source } from "@/lib/types";

/** Live registry never boots from mock seeds — upload/CSV only. */
export const EMPTY_SOURCES: Source[] = [];

function isValidSource(s: unknown): s is Source {
  if (!s || typeof s !== "object") return false;
  const row = s as Partial<Source>;
  if (!row.id || typeof row.id !== "string") return false;
  if (!row.title || typeof row.title !== "string" || !row.title.trim()) return false;
  return true;
}

function sortSources(sources: Source[]) {
  return [...sources].sort(
    (a, b) =>
      (b.totalSourceScore ?? 0) - (a.totalSourceScore ?? 0) ||
      a.title.localeCompare(b.title)
  );
}

/**
 * Canonical live source registry read.
 * - Never falls back to SEED_SOURCES
 * - Drops corrupt / incomplete rows
 */
export async function readLiveSources(): Promise<{
  sources: Source[];
  droppedInvalid: number;
}> {
  const raw = await readCollection<Source>("sources", EMPTY_SOURCES);
  const valid = raw.filter(isValidSource);
  const droppedInvalid = raw.length - valid.length;
  if (droppedInvalid > 0) {
    await writeCollection("sources", valid);
  }
  return { sources: sortSources(valid), droppedInvalid };
}

/** Raw RMW helper for probe/capture/update paths. */
export async function readSourcesCollection(): Promise<Source[]> {
  const { sources } = await readLiveSources();
  return sources;
}

export async function writeSourcesCollection(sources: Source[]): Promise<void> {
  await writeCollection("sources", sources.filter(isValidSource));
}

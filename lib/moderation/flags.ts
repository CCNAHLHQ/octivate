import { readObject, writeObject } from "@/lib/store/json-store";
import type { ModerationCollection } from "@/lib/moderation/constants";

export type ModerationFlag = {
  key: string;
  collection: ModerationCollection;
  id: string;
  flagged: boolean;
  hidden: boolean;
  note?: string;
  updatedAt: string;
};

type FlagMap = Record<string, ModerationFlag>;

const STORE = "moderation-flags";

export function flagKey(collection: ModerationCollection, id: string) {
  return `${collection}:${id}`;
}

export async function readFlags(): Promise<FlagMap> {
  return readObject<FlagMap>(STORE, {});
}

export async function upsertFlag(
  collection: ModerationCollection,
  id: string,
  patch: Partial<Pick<ModerationFlag, "flagged" | "hidden" | "note">>
): Promise<ModerationFlag> {
  const all = await readFlags();
  const key = flagKey(collection, id);
  const prev = all[key];
  const next: ModerationFlag = {
    key,
    collection,
    id,
    flagged: patch.flagged ?? prev?.flagged ?? false,
    hidden: patch.hidden ?? prev?.hidden ?? false,
    note: patch.note ?? prev?.note,
    updatedAt: new Date().toISOString(),
  };
  if (!next.flagged && !next.hidden && !next.note) {
    delete all[key];
  } else {
    all[key] = next;
  }
  await writeObject(STORE, all);
  return next;
}

export async function clearFlag(collection: ModerationCollection, id: string): Promise<void> {
  const all = await readFlags();
  delete all[flagKey(collection, id)];
  await writeObject(STORE, all);
}

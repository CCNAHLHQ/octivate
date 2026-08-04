import { readObject, writeObject } from "@/lib/store/json-store";
import { hashSource } from "@/lib/i18n/hash";

export type CachedEntry = {
  text: string;
  sourceHash: string;
  updatedAt: string;
};

export type I18nCacheFile = {
  version: 1;
  locales: Record<string, Record<string, CachedEntry>>;
};

const CACHE_NAME = "i18n-cache";
const EMPTY: I18nCacheFile = { version: 1, locales: {} };

let writeChain: Promise<void> = Promise.resolve();

export async function readI18nCache(): Promise<I18nCacheFile> {
  const data = await readObject<I18nCacheFile>(CACHE_NAME, EMPTY);
  if (!data?.locales || typeof data.locales !== "object") return { ...EMPTY };
  return { version: 1, locales: data.locales };
}

export async function writeI18nCache(next: I18nCacheFile): Promise<void> {
  writeChain = writeChain.then(async () => {
    await writeObject(CACHE_NAME, next);
  });
  await writeChain;
}

export function entryFresh(entry: CachedEntry | undefined, source: string): boolean {
  if (!entry?.text) return false;
  return entry.sourceHash === hashSource(source);
}

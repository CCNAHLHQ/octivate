import { promises as fs } from "fs";
import path from "path";
import { hashSource } from "@/lib/i18n/hash";
import { readObject, writeObject } from "@/lib/store/json-store";
import type { MessageDict } from "@/lib/i18n/messages";

export type LocaleEntry = {
  text: string;
  sourceHash: string;
  updatedAt: string;
};

export type LocaleFile = {
  locale: string;
  version: number;
  updatedAt: string;
  entries: Record<string, LocaleEntry>;
};

export type I18nMeta = {
  version: number;
  updatedAt: string;
  lastSyncAt?: string;
  lastSyncLocales?: string[];
};

const ROOT = path.join(process.cwd(), "data", "local", "i18n");
const META_NAME = "i18n-meta";
/** Legacy single-file cache — migrated once into per-locale files. */
const LEGACY_CACHE = "i18n-cache";

let writeChain: Promise<void> = Promise.resolve();
let syncLocked = false;

function localePath(locale: string) {
  return path.join(ROOT, "locales", `${locale}.json`);
}

async function ensureDirs() {
  await fs.mkdir(path.join(ROOT, "locales"), { recursive: true });
}

function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function readMeta(): Promise<I18nMeta> {
  return readObject<I18nMeta>(META_NAME, {
    version: 1,
    updatedAt: new Date(0).toISOString(),
  });
}

export async function writeMeta(meta: I18nMeta): Promise<void> {
  await enqueueWrite(() => writeObject(META_NAME, meta));
}

export async function readLocaleFile(locale: string): Promise<LocaleFile> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(localePath(locale), "utf8");
    const parsed = JSON.parse(raw) as LocaleFile;
    if (!parsed?.entries || typeof parsed.entries !== "object") {
      return { locale, version: 1, updatedAt: new Date(0).toISOString(), entries: {} };
    }
    return parsed;
  } catch {
    return { locale, version: 1, updatedAt: new Date(0).toISOString(), entries: {} };
  }
}

export async function writeLocaleFile(file: LocaleFile): Promise<void> {
  await enqueueWrite(async () => {
    await ensureDirs();
    const tmp = `${localePath(file.locale)}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(file, null, 2), "utf8");
    await fs.rename(tmp, localePath(file.locale));
  });
}

export function entryFresh(entry: LocaleEntry | undefined, source: string): boolean {
  if (!entry) return false;
  // Allow empty translations only when source is empty.
  if (!entry.text && source) return false;
  return entry.sourceHash === hashSource(source);
}

/** One-time migrate from data/local/i18n-cache.json into per-locale files. */
export async function migrateLegacyCacheOnce(): Promise<void> {
  await ensureDirs();
  try {
    const legacy = await readObject<{
      version?: number;
      locales?: Record<string, Record<string, LocaleEntry>>;
    }>(LEGACY_CACHE, { version: 1, locales: {} });
    const locales = legacy.locales || {};
    for (const [locale, entries] of Object.entries(locales)) {
      const existing = await readLocaleFile(locale);
      if (Object.keys(existing.entries).length) continue;
      await writeLocaleFile({
        locale,
        version: 1,
        updatedAt: new Date().toISOString(),
        entries: entries || {},
      });
    }
  } catch {
    /* no legacy file */
  }
}

export async function mergeCatalog(
  locale: string,
  english: MessageDict,
  dynamic: MessageDict = {}
): Promise<{ messages: MessageDict; coverage: { total: number; translated: number; stale: number } }> {
  const file = await readLocaleFile(locale);
  const source: MessageDict = { ...english, ...dynamic };
  const messages: MessageDict = { ...source };
  let translated = 0;
  let stale = 0;
  for (const [key, en] of Object.entries(source)) {
    const hit = file.entries[key];
    if (entryFresh(hit, en)) {
      messages[key] = hit.text;
      translated += 1;
    } else if (hit?.text) {
      messages[key] = hit.text;
      stale += 1;
    }
  }
  return {
    messages,
    coverage: { total: Object.keys(source).length, translated, stale },
  };
}

export function tryAcquireSyncLock(): boolean {
  if (syncLocked) return false;
  syncLocked = true;
  return true;
}

export function releaseSyncLock(): void {
  syncLocked = false;
}

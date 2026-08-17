import { promises as fs } from "fs";
import path from "path";
import { hashSource } from "@/lib/i18n/hash";
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

/**
 * Durable catalogs — committed under data/i18n (NOT data/local).
 * data/local is gitignored and was wiping/losing all translations on host resets.
 */
const ROOT = path.join(process.cwd(), "data", "i18n");
const META_PATH = path.join(ROOT, "meta.json");
const LEGACY_LOCAL_ROOT = path.join(process.cwd(), "data", "local", "i18n");
const LEGACY_CACHE = path.join(process.cwd(), "data", "local", "i18n-cache.json");
const LEGACY_META = path.join(process.cwd(), "data", "local", "i18n-meta.json");

let writeChain: Promise<void> = Promise.resolve();
let syncLocked = false;
let migrated = false;

function localePath(locale: string, root = ROOT) {
  return path.join(root, "locales", `${locale}.json`);
}

async function ensureDirs(root = ROOT) {
  await fs.mkdir(path.join(root, "locales"), { recursive: true });
}

function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function readMeta(): Promise<I18nMeta> {
  await ensureDirs();
  return readJsonFile<I18nMeta>(META_PATH, {
    version: 1,
    updatedAt: new Date(0).toISOString(),
  });
}

export async function writeMeta(meta: I18nMeta): Promise<void> {
  await enqueueWrite(async () => {
    await ensureDirs();
    const tmp = `${META_PATH}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(meta, null, 2), "utf8");
    await fs.rename(tmp, META_PATH);
  });
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

async function copyLocaleIfMissing(locale: string, fromRoot: string) {
  const dest = localePath(locale);
  try {
    await fs.access(dest);
    return;
  } catch {
    /* missing — try legacy */
  }
  try {
    const src = localePath(locale, fromRoot);
    await fs.access(src);
    await ensureDirs();
    await fs.copyFile(src, dest);
  } catch {
    /* no legacy locale */
  }
}

/** Migrate once from gitignored data/local paths into durable data/i18n. */
export async function migrateLegacyCacheOnce(): Promise<void> {
  if (migrated) return;
  migrated = true;
  await ensureDirs();

  // Prefer per-locale files under data/local/i18n/locales.
  try {
    const legacyLocales = path.join(LEGACY_LOCAL_ROOT, "locales");
    const names = await fs.readdir(legacyLocales);
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      await copyLocaleIfMissing(name.replace(/\.json$/, ""), LEGACY_LOCAL_ROOT);
    }
  } catch {
    /* no legacy dir */
  }

  // Legacy single-file cache.
  try {
    const legacy = await readJsonFile<{
      version?: number;
      locales?: Record<string, Record<string, LocaleEntry>>;
    }>(LEGACY_CACHE, { version: 1, locales: {} });
    for (const [locale, entries] of Object.entries(legacy.locales || {})) {
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

  // Meta from old json-store file if durable meta is still default.
  const meta = await readMeta();
  if (!meta.lastSyncAt) {
    const legacyMeta = await readJsonFile<I18nMeta | null>(LEGACY_META, null);
    if (legacyMeta?.lastSyncAt || (legacyMeta && legacyMeta.version > 1)) {
      await writeMeta({
        version: Number(legacyMeta.version || 1),
        updatedAt: legacyMeta.updatedAt || new Date().toISOString(),
        lastSyncAt: legacyMeta.lastSyncAt,
        lastSyncLocales: legacyMeta.lastSyncLocales,
      });
    }
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

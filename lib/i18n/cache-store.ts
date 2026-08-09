/**
 * Compatibility shim — permanent catalogs live in lib/i18n/store.ts.
 * Kept so older imports continue to typecheck during migration.
 */
export {
  entryFresh,
  readLocaleFile as readI18nCacheFile,
  type LocaleEntry as CachedEntry,
} from "@/lib/i18n/store";
import { readLocaleFile, writeLocaleFile, type LocaleFile } from "@/lib/i18n/store";

/** @deprecated Use per-locale store helpers. */
export type I18nCacheFile = {
  version: 1;
  locales: Record<string, LocaleFile["entries"]>;
};

export async function readI18nCache(): Promise<I18nCacheFile> {
  // Aggregate view for legacy callers.
  const { TRANSLATE_LANGUAGES, PAGE_LANGUAGE } = await import("@/lib/i18n/languages");
  const locales: I18nCacheFile["locales"] = {};
  for (const lang of TRANSLATE_LANGUAGES) {
    if (lang.value === PAGE_LANGUAGE) continue;
    const file = await readLocaleFile(lang.value);
    locales[lang.value] = file.entries;
  }
  return { version: 1, locales };
}

export async function writeI18nCache(next: I18nCacheFile): Promise<void> {
  for (const [locale, entries] of Object.entries(next.locales || {})) {
    await writeLocaleFile({
      locale,
      version: 1,
      updatedAt: new Date().toISOString(),
      entries,
    });
  }
}

import { getEnglishSource, normalizeLocale, type MessageDict } from "@/lib/i18n/messages";
import { loadDynamicEnglish } from "@/lib/i18n/dynamic";
import { PAGE_LANGUAGE } from "@/lib/i18n/languages";
import {
  mergeCatalog,
  migrateLegacyCacheOnce,
  readMeta,
} from "@/lib/i18n/store";

/**
 * Resolve a locale catalog from permanent server-side storage.
 * Never calls the translation API — use syncI18nCatalogs for that.
 */
export async function resolveCatalog(localeRaw: string): Promise<{
  locale: string;
  messages: MessageDict;
  cached: boolean;
  translatedKeys: number;
  catalogVersion: number;
  coverage: { total: number; translated: number; stale: number };
}> {
  const locale = normalizeLocale(localeRaw);
  await migrateLegacyCacheOnce();
  const english = getEnglishSource();
  const dynamic = await loadDynamicEnglish();
  const source = { ...english, ...dynamic };
  const meta = await readMeta();

  if (locale === PAGE_LANGUAGE) {
    return {
      locale,
      messages: source,
      cached: true,
      translatedKeys: 0,
      catalogVersion: meta.version,
      coverage: {
        total: Object.keys(source).length,
        translated: Object.keys(source).length,
        stale: 0,
      },
    };
  }

  const { messages, coverage } = await mergeCatalog(locale, english, dynamic);
  return {
    locale,
    messages,
    cached: coverage.stale === 0 && coverage.translated === coverage.total,
    translatedKeys: coverage.translated,
    catalogVersion: meta.version,
    coverage,
  };
}

/** Re-export for callers that imported translateBatch from here. */
export { translateBatch, syncI18nCatalogs, getI18nStatus } from "@/lib/i18n/sync";

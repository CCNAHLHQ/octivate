import { getOpenRouterClient } from "@/lib/openrouter/client";
import { resolveModel } from "@/lib/openrouter/config";
import { completeJson, getThrownCompletionSpend } from "@/lib/openrouter/json";
import { recordUsage } from "@/lib/usage/usage-store";
import {
  entryFresh,
  readI18nCache,
  writeI18nCache,
  type CachedEntry,
} from "@/lib/i18n/cache-store";
import {
  EN_MESSAGES,
  normalizeLocale,
  type MessageDict,
} from "@/lib/i18n/messages";
import { hashSource } from "@/lib/i18n/hash";
import { PAGE_LANGUAGE } from "@/lib/i18n/languages";

const LOCALE_LABELS: Record<string, string> = {
  es: "Spanish",
  fr: "French",
  ht: "Haitian Creole (Kreyòl)",
  nl: "Dutch",
  pt: "Portuguese",
  de: "German",
  "zh-CN": "Simplified Chinese",
  ar: "Arabic",
  hi: "Hindi",
};

async function translateBatch(
  locale: string,
  entries: MessageDict
): Promise<MessageDict> {
  const keys = Object.keys(entries);
  if (!keys.length) return {};

  const client = getOpenRouterClient();
  const localeName = LOCALE_LABELS[locale] || locale;

  const model = resolveModel(false);
  try {
    const { data, result } = await completeJson(
      client,
      {
        model,
        maxTokens: 3500,
        messages: [
          {
            role: "system",
            content: [
              `You localize UI copy for Octivate, a Caribbean decision-intelligence SaaS by CENSII.`,
              `Translate each JSON value into ${localeName} (locale code: ${locale}).`,
              `Keep brand names unchanged: Octivate, CENSII, PSN.`,
              `Preserve punctuation, em dashes, and placeholders.`,
              `Return ONLY a JSON object with the same keys and translated string values.`,
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify(entries),
          },
        ],
      },
      (raw) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
          throw new Error("Expected translation object");
        }
        const out: MessageDict = {};
        for (const key of keys) {
          const value = (raw as Record<string, unknown>)[key];
          if (typeof value === "string" && value.trim()) out[key] = value.trim();
        }
        if (!Object.keys(out).length) throw new Error("Empty translation payload");
        return out;
      }
    );
    if (result.totalTokens > 0 || result.costUsd > 0) {
      await recordUsage({
        tokens: result.totalTokens,
        cost: result.costUsd,
        model: result.model || model,
        label: `UI translate · ${locale}`,
        countSession: false,
        premium: false,
        channel: "i18n",
        costSource: result.costSource,
        generationId: result.generationId,
      });
    }
    return data;
  } catch (err) {
    const spent = getThrownCompletionSpend(err);
    if (spent && (spent.totalTokens > 0 || spent.costUsd > 0)) {
      await recordUsage({
        tokens: spent.totalTokens,
        cost: spent.costUsd,
        model: spent.model || model,
        label: `UI translate · ${locale} (failed)`,
        countSession: false,
        premium: false,
        channel: "i18n",
        costSource: spent.costSource === "mixed" ? "estimate" : spent.costSource,
        generationId: spent.generationId,
      }).catch(() => null);
    }
    // Soft-fail: callers keep English for missing keys.
    return {};
  }
}

/**
 * Resolve a locale catalog: English source + server cache, auto-filling gaps via OpenRouter.
 */
export async function resolveCatalog(localeRaw: string): Promise<{
  locale: string;
  messages: MessageDict;
  cached: boolean;
  translatedKeys: number;
}> {
  const locale = normalizeLocale(localeRaw);
  const english: MessageDict = { ...EN_MESSAGES };

  if (locale === PAGE_LANGUAGE) {
    return { locale, messages: english, cached: true, translatedKeys: 0 };
  }

  const cache = await readI18nCache();
  const localeBucket = { ...(cache.locales[locale] || {}) };
  const missing: MessageDict = {};
  const resolved: MessageDict = { ...english };

  for (const [key, source] of Object.entries(english)) {
    const hit = localeBucket[key];
    if (entryFresh(hit, source)) {
      resolved[key] = hit.text;
    } else {
      missing[key] = source;
    }
  }

  let translatedKeys = 0;
  if (Object.keys(missing).length) {
    const translated = await translateBatch(locale, missing);
    const now = new Date().toISOString();
    for (const [key, source] of Object.entries(missing)) {
      const text = translated[key];
      if (!text) continue;
      const entry: CachedEntry = {
        text,
        sourceHash: hashSource(source),
        updatedAt: now,
      };
      localeBucket[key] = entry;
      resolved[key] = text;
      translatedKeys += 1;
    }
    if (translatedKeys > 0) {
      cache.locales[locale] = localeBucket;
      await writeI18nCache(cache);
    }
  }

  const fromCache = Object.keys(english).every((key) =>
    entryFresh(localeBucket[key], english[key])
  );

  return {
    locale,
    messages: resolved,
    cached: fromCache || translatedKeys === 0,
    translatedKeys,
  };
}

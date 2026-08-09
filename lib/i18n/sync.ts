import { getOpenRouterClient } from "@/lib/openrouter/client";
import { resolveModel } from "@/lib/openrouter/config";
import { completeJson, getThrownCompletionSpend } from "@/lib/openrouter/json";
import { recordUsage } from "@/lib/usage/usage-store";
import { hashSource } from "@/lib/i18n/hash";
import { getEnglishSource, normalizeLocale, type MessageDict } from "@/lib/i18n/messages";
import { loadDynamicEnglish } from "@/lib/i18n/dynamic";
import { PAGE_LANGUAGE, TRANSLATE_LANGUAGES } from "@/lib/i18n/languages";
import {
  entryFresh,
  migrateLegacyCacheOnce,
  readLocaleFile,
  readMeta,
  releaseSyncLock,
  tryAcquireSyncLock,
  writeLocaleFile,
  writeMeta,
  type LocaleEntry,
} from "@/lib/i18n/store";

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

/** Smaller batches improve JSON reliability for dense UI catalogs. */
const CHUNK = 20;

function chunkEntries(entries: MessageDict, size = CHUNK): MessageDict[] {
  const keys = Object.keys(entries);
  const out: MessageDict[] = [];
  for (let i = 0; i < keys.length; i += size) {
    const slice: MessageDict = {};
    for (const k of keys.slice(i, i + size)) slice[k] = entries[k];
    out.push(slice);
  }
  return out;
}

export async function translateBatch(
  locale: string,
  entries: MessageDict
): Promise<MessageDict> {
  const keys = Object.keys(entries);
  if (!keys.length) return {};

  const client = getOpenRouterClient();
  const localeName = LOCALE_LABELS[locale] || locale;
  const model = resolveModel(false);
  const merged: MessageDict = {};

  for (const batch of chunkEntries(entries)) {
    const batchKeys = Object.keys(batch);
    try {
      const { data, result } = await completeJson(
        client,
        {
          model,
          maxTokens: 4500,
          messages: [
            {
              role: "system",
              content: [
                `You localize UI and short editorial copy for Octivate, a Caribbean decision-intelligence SaaS by CENSII.`,
                `Translate each JSON value into ${localeName} (locale code: ${locale}).`,
                `Keep brand names unchanged: Octivate, CENSII, PSN, OpenRouter.`,
                `Preserve punctuation, em dashes, placeholders, and URLs.`,
                `Return ONLY a JSON object with the same keys and translated string values.`,
              ].join(" "),
            },
            { role: "user", content: JSON.stringify(batch) },
          ],
        },
        (raw) => {
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            throw new Error("Expected translation object");
          }
          const out: MessageDict = {};
          for (const key of batchKeys) {
            const value = (raw as Record<string, unknown>)[key];
            if (typeof value === "string") out[key] = value.trim();
          }
          if (!Object.keys(out).length) throw new Error("Empty translation payload");
          return out;
        }
      );
      Object.assign(merged, data);
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
    }
  }
  return merged;
}

export type SyncResult = {
  ok: boolean;
  locked?: boolean;
  locales: Array<{
    locale: string;
    missing: number;
    translated: number;
    coverage: number;
  }>;
  catalogVersion: number;
};

export async function getI18nStatus() {
  await migrateLegacyCacheOnce();
  const english = { ...getEnglishSource(), ...(await loadDynamicEnglish()) };
  const meta = await readMeta();
  const locales = [];
  for (const lang of TRANSLATE_LANGUAGES) {
    if (lang.value === PAGE_LANGUAGE) continue;
    const file = await readLocaleFile(lang.value);
    let translated = 0;
    let stale = 0;
    for (const [key, en] of Object.entries(english)) {
      const hit = file.entries[key];
      if (entryFresh(hit, en)) translated += 1;
      else if (hit?.text) stale += 1;
    }
    const total = Object.keys(english).length;
    locales.push({
      locale: lang.value,
      label: lang.label,
      total,
      translated,
      stale,
      missing: total - translated - stale,
      coverage: total ? Math.round((translated / total) * 100) : 100,
      updatedAt: file.updatedAt,
    });
  }
  return {
    catalogVersion: meta.version,
    lastSyncAt: meta.lastSyncAt || null,
    sourceKeys: Object.keys(english).length,
    locales,
  };
}

export async function syncI18nCatalogs(opts?: {
  locales?: string[];
}): Promise<SyncResult> {
  if (!tryAcquireSyncLock()) {
    return { ok: false, locked: true, locales: [], catalogVersion: (await readMeta()).version };
  }
  try {
    await migrateLegacyCacheOnce();
    const english = { ...getEnglishSource(), ...(await loadDynamicEnglish()) };
    const targets = (opts?.locales?.length
      ? opts.locales.map(normalizeLocale)
      : TRANSLATE_LANGUAGES.map((l) => l.value)
    ).filter((l) => l !== PAGE_LANGUAGE);

    const summary: SyncResult["locales"] = [];
    for (const locale of targets) {
      const file = await readLocaleFile(locale);
      const missing: MessageDict = {};
      const nowSeed = new Date().toISOString();
      for (const [key, source] of Object.entries(english)) {
        if (entryFresh(file.entries[key], source)) continue;
        // Empty English strings need no LLM round-trip.
        if (!source.trim()) {
          file.entries[key] = {
            text: "",
            sourceHash: hashSource(source),
            updatedAt: nowSeed,
          };
          continue;
        }
        missing[key] = source;
      }
      const translated = await translateBatch(locale, missing);
      const now = new Date().toISOString();
      let wrote = 0;
      for (const [key, source] of Object.entries(missing)) {
        const text = translated[key];
        if (text === undefined) continue;
        const entry: LocaleEntry = {
          text,
          sourceHash: hashSource(source),
          updatedAt: now,
        };
        file.entries[key] = entry;
        wrote += 1;
      }
      file.updatedAt = now;
      file.version += 1;
      if (wrote > 0) await writeLocaleFile(file);

      let covered = 0;
      for (const [key, source] of Object.entries(english)) {
        if (entryFresh(file.entries[key], source)) covered += 1;
      }
      summary.push({
        locale,
        missing: Object.keys(missing).length,
        translated: wrote,
        coverage: Object.keys(english).length
          ? Math.round((covered / Object.keys(english).length) * 100)
          : 100,
      });
    }

    const meta = await readMeta();
    const nextVersion = meta.version + 1;
    await writeMeta({
      version: nextVersion,
      updatedAt: new Date().toISOString(),
      lastSyncAt: new Date().toISOString(),
      lastSyncLocales: targets,
    });

    return { ok: true, locales: summary, catalogVersion: nextVersion };
  } finally {
    releaseSyncLock();
  }
}

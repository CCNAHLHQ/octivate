import { getOpenRouterClient } from "@/lib/openrouter/client";
import { resolveDocsModel, resolveModel } from "@/lib/openrouter/config";
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

/** Smaller batches improve JSON reliability for dense UI + legal catalogs. */
const CHUNK = 8;

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
  // Prefer docs-class model for reliable JSON localization of long legal/UI strings.
  const model = resolveDocsModel() || resolveModel(false);
  const merged: MessageDict = {};

  for (const batch of chunkEntries(entries)) {
    const batchKeys = Object.keys(batch);
    try {
      const { data, result } = await completeJson(
        client,
        {
          model,
          maxTokens: 6000,
          messages: [
            {
              role: "system",
              content: [
                `You localize UI, marketing, cookie consent, and legal copy for Octivate, a Caribbean decision-intelligence SaaS by CENSII.`,
                `Translate each JSON value into ${localeName} (locale code: ${locale}).`,
                `Keep brand names unchanged: Octivate, CENSII, PSN, OpenRouter, Stripe, PayPal, ChatGPT, Claude, Bitcoin.`,
                `Preserve punctuation, em dashes, placeholders like {n}, emails, and URLs.`,
                `For legal text, keep meaning precise; do not invent new obligations.`,
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
      if (Object.keys(merged).length % 40 === 0 || batchKeys.length < CHUNK) {
        console.log(
          `[i18n-sync] ${locale}: progress ${Object.keys(merged).length}/${keys.length}`
        );
      }
    } catch (err) {
      const spent = getThrownCompletionSpend(err);
      console.warn(
        `[i18n-sync] batch failed locale=${locale} keys=${batchKeys.length}:`,
        err instanceof Error ? err.message : err
      );
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
      console.log(`[i18n-sync] locale=${locale}`);
      const file = await readLocaleFile(locale);
      const missing: MessageDict = {};
      const nowSeed = new Date().toISOString();
      for (const [key, source] of Object.entries(english)) {
        if (entryFresh(file.entries[key], source)) continue;
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

      const missingKeys = Object.keys(missing);
      console.log(`[i18n-sync] ${locale}: translating ${missingKeys.length} keys`);
      let wrote = 0;

      // Translate + checkpoint per chunk so long runs survive hangs/restarts.
      for (const batch of chunkEntries(missing)) {
        const batchKeys = Object.keys(batch);
        const translated = await translateBatch(locale, batch);
        const now = new Date().toISOString();
        let batchWrote = 0;
        for (const key of batchKeys) {
          const text = translated[key];
          const source = missing[key];
          if (text === undefined || source === undefined) continue;
          file.entries[key] = {
            text,
            sourceHash: hashSource(source),
            updatedAt: now,
          };
          batchWrote += 1;
          wrote += 1;
        }
        if (batchWrote > 0) {
          file.updatedAt = now;
          file.version += 1;
          await writeLocaleFile(file);
        }
        console.log(
          `[i18n-sync] ${locale}: checkpoint ${wrote}/${missingKeys.length} (+${batchWrote}/${batchKeys.length})`
        );
      }

      // Persist even if nothing new (empty-source keys, etc.).
      file.updatedAt = new Date().toISOString();
      await writeLocaleFile(file);

      let covered = 0;
      for (const [key, source] of Object.entries(english)) {
        if (entryFresh(file.entries[key], source)) covered += 1;
      }
      summary.push({
        locale,
        missing: missingKeys.length,
        translated: wrote,
        coverage: Object.keys(english).length
          ? Math.round((covered / Object.keys(english).length) * 100)
          : 100,
      });
      console.log(`[i18n-sync] ${locale}: done coverage=${summary.at(-1)?.coverage}%`);
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

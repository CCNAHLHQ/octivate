import { getAppConfig, setAppConfig } from "@/lib/supabase/ops-db";
import { DEFAULT_OPENROUTER_MODEL } from "@/lib/openrouter/config-constants";
import { catalogModelIds } from "@/lib/openrouter/model-catalog";

export type ReasoningEffort = "low" | "medium" | "high";

/** Document tooling feature class (extract + summarize) — lighter than doctrine. */
export type DocsFeatureClass = {
  enabled: boolean;
  model: string;
  maxTokens: number;
  allowFocus: boolean;
  allowRework: boolean;
};

export type ModelConfig = {
  defaultModel: string;
  premiumModel: string;
  fallbackModel: string;
  temperature: number;
  doctrineMaxTokens: number;
  reasoningMaxTokens: number;
  reasoningBudget: number;
  reasoningEffort: ReasoningEffort;
  maxConcurrent: number;
  timeoutMs: number;
  allowlist: string[];
  /** Document summary / extract tooling (separate from doctrine routing). */
  docs: DocsFeatureClass;
};

const NEMOTRON_DEFAULT = "nvidia/nemotron-3.5-lightning:free";
const NEMOTRON_PREMIUM = "nvidia/nemotron-3-ultra-550b-a55b:free";
/** Strong flash-tier default for document tooling — cheaper than doctrine Super. */
const DOCS_DEFAULT_MODEL = "deepseek/deepseek-v4-flash";

const BASE_ALLOWLIST = [
  NEMOTRON_DEFAULT,
  "nvidia/nemotron-3.5-lightning",
  "nvidia/nemotron-3-super-120b-a12b:free",
  NEMOTRON_PREMIUM,
  "nvidia/nemotron-3-nano-30b-a3b:free",
  DOCS_DEFAULT_MODEL,
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-sonnet-4",
  "openai/gpt-4o",
  "google/gemini-2.5-pro",
  ...catalogModelIds(),
];

export const RECOMMENDED_DOCS_FEATURE: DocsFeatureClass = {
  enabled: true,
  model: DOCS_DEFAULT_MODEL,
  maxTokens: 1600,
  allowFocus: true,
  allowRework: true,
};

export const RECOMMENDED_MODEL_CONFIG: ModelConfig = {
  defaultModel: NEMOTRON_DEFAULT,
  premiumModel: NEMOTRON_PREMIUM,
  fallbackModel: DEFAULT_OPENROUTER_MODEL || NEMOTRON_DEFAULT,
  temperature: 0.2,
  doctrineMaxTokens: 6000,
  reasoningMaxTokens: 8192,
  reasoningBudget: 2048,
  reasoningEffort: "low",
  maxConcurrent: 3,
  timeoutMs: 120_000,
  allowlist: Array.from(new Set(BASE_ALLOWLIST)),
  docs: { ...RECOMMENDED_DOCS_FEATURE },
};

const STORE_KEY = "model-config";

let cache: ModelConfig | null = null;
let hydratePromise: Promise<ModelConfig> | null = null;

function clampDocsFeature(
  raw: Partial<DocsFeatureClass> | null | undefined,
  allowlist: string[]
): DocsFeatureClass {
  const base = { ...RECOMMENDED_DOCS_FEATURE, ...(raw || {}) };
  const pick = (value: string, fallback: string) =>
    allowlist.includes(value) ? value : allowlist.includes(fallback) ? fallback : allowlist[0];
  return {
    enabled: base.enabled !== false,
    model: pick(String(base.model || ""), RECOMMENDED_DOCS_FEATURE.model),
    maxTokens: Math.min(4000, Math.max(512, Number(base.maxTokens) || 1600)),
    allowFocus: base.allowFocus !== false,
    allowRework: base.allowRework !== false,
  };
}

function clampConfig(raw: Partial<ModelConfig> | null | undefined): ModelConfig {
  const base = { ...RECOMMENDED_MODEL_CONFIG, ...(raw || {}) };
  const allowlist =
    Array.isArray(base.allowlist) && base.allowlist.length
      ? Array.from(
          new Set([
            ...base.allowlist.map(String),
            ...catalogModelIds(),
            RECOMMENDED_DOCS_FEATURE.model,
          ])
        )
      : RECOMMENDED_MODEL_CONFIG.allowlist;

  const pick = (value: string, fallback: string) =>
    allowlist.includes(value) ? value : allowlist.includes(fallback) ? fallback : allowlist[0];

  const effort = (["low", "medium", "high"] as const).includes(
    base.reasoningEffort as ReasoningEffort
  )
    ? (base.reasoningEffort as ReasoningEffort)
    : "low";

  const docs = clampDocsFeature(
    (raw as { docs?: Partial<DocsFeatureClass> } | null | undefined)?.docs ?? base.docs,
    allowlist
  );

  return {
    defaultModel: pick(base.defaultModel, RECOMMENDED_MODEL_CONFIG.defaultModel),
    premiumModel: pick(base.premiumModel, RECOMMENDED_MODEL_CONFIG.premiumModel),
    fallbackModel: pick(base.fallbackModel, RECOMMENDED_MODEL_CONFIG.fallbackModel),
    temperature: Math.min(1.5, Math.max(0, Number(base.temperature) || 0.2)),
    doctrineMaxTokens: Math.min(16000, Math.max(512, Number(base.doctrineMaxTokens) || 6000)),
    reasoningMaxTokens: Math.min(32000, Math.max(1024, Number(base.reasoningMaxTokens) || 8192)),
    reasoningBudget: Math.min(16000, Math.max(256, Number(base.reasoningBudget) || 2048)),
    reasoningEffort: effort,
    maxConcurrent: Math.min(12, Math.max(1, Math.round(Number(base.maxConcurrent) || 3))),
    timeoutMs: Math.min(300_000, Math.max(15_000, Number(base.timeoutMs) || 120_000)),
    allowlist,
    docs,
  };
}

function bootstrapFromEnv(): ModelConfig {
  return clampConfig({
    ...RECOMMENDED_MODEL_CONFIG,
    defaultModel:
      process.env.OPENROUTER_DEFAULT_MODEL || RECOMMENDED_MODEL_CONFIG.defaultModel,
    premiumModel:
      process.env.OPENROUTER_PREMIUM_MODEL || RECOMMENDED_MODEL_CONFIG.premiumModel,
    fallbackModel:
      process.env.OPENROUTER_FALLBACK_MODEL || RECOMMENDED_MODEL_CONFIG.fallbackModel,
  });
}

export function getCachedModelConfig(): ModelConfig {
  return cache || bootstrapFromEnv();
}

export async function readModelConfig(): Promise<ModelConfig> {
  if (cache) return cache;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      const stored = await getAppConfig<ModelConfig>(STORE_KEY);
      const next = stored ? clampConfig(stored) : bootstrapFromEnv();
      if (!stored) await setAppConfig(STORE_KEY, next);
      else {
        // Ensure curated catalog (Nemotron / DeepSeek / Kimi) stays merged into allowlist.
        const merged = clampConfig(stored);
        const before = new Set((stored.allowlist || []).map(String));
        const added = merged.allowlist.some((id) => !before.has(id));
        if (added || merged.allowlist.length !== stored.allowlist?.length) {
          await setAppConfig(STORE_KEY, merged);
          cache = merged;
          return merged;
        }
      }
      cache = next;
      return next;
    })().finally(() => {
      hydratePromise = null;
    });
  }
  return hydratePromise;
}

export async function writeModelConfig(patch: Partial<ModelConfig>): Promise<ModelConfig> {
  const current = await readModelConfig();
  const next = clampConfig({
    ...current,
    ...patch,
    docs: patch.docs ? { ...current.docs, ...patch.docs } : current.docs,
  });
  const allow = new Set(next.allowlist);
  [next.defaultModel, next.premiumModel, next.fallbackModel, next.docs.model].forEach((m) =>
    allow.add(m)
  );
  next.allowlist = Array.from(allow);
  await setAppConfig(STORE_KEY, next);
  cache = next;
  return next;
}

export async function resetModelConfig(): Promise<ModelConfig> {
  const next = clampConfig(RECOMMENDED_MODEL_CONFIG);
  await setAppConfig(STORE_KEY, next);
  cache = next;
  return next;
}

/** Fire-and-forget hydrate for server boot paths. */
export function warmModelConfig(): void {
  void readModelConfig().catch(() => {
    /* boot without blocking if Supabase is briefly unavailable */
  });
}

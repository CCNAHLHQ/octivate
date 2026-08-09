import {
  envMockDefault,
  getRuntimeMockOverride,
  resolveMockOpenRouter,
} from "./runtime-mode";
import { DEFAULT_OPENROUTER_MODEL } from "./config-constants";
import { getCachedModelConfig, warmModelConfig } from "./model-config-store";
import { depthTokenMultiplier } from "@/lib/protocol/depth";
import type { AnalysisDepth } from "@/lib/types";

export { DEFAULT_OPENROUTER_MODEL };

warmModelConfig();

/** Used when primary returns empty / soft-fails after retries. */
export function getFallbackOpenRouterModel(): string {
  return getCachedModelConfig().fallbackModel || DEFAULT_OPENROUTER_MODEL;
}

/** @deprecated prefer getFallbackOpenRouterModel() */
export const FALLBACK_OPENROUTER_MODEL = DEFAULT_OPENROUTER_MODEL;

export function isMockOpenRouter(): boolean {
  return resolveMockOpenRouter();
}

export function resolveModel(allowPremium: boolean): string {
  const cfg = getCachedModelConfig();
  if (allowPremium && cfg.premiumModel) return cfg.premiumModel;
  return cfg.defaultModel || DEFAULT_OPENROUTER_MODEL;
}

/** Document extract/summarize route — feature-class model, not doctrine premium. */
export function resolveDocsModel(): string {
  const cfg = getCachedModelConfig();
  return cfg.docs?.model || "deepseek/deepseek-v4-flash";
}

export function resolveDocsMaxTokens(): number {
  return getCachedModelConfig().docs?.maxTokens || 1600;
}

export function getDocsFeatureClass() {
  return getCachedModelConfig().docs;
}

export function openRouterMode(): "mock" | "live" {
  return isMockOpenRouter() ? "mock" : "live";
}

export function openRouterModeSource(): "runtime" | "env" {
  return getRuntimeMockOverride() !== null ? "runtime" : "env";
}

/** Nemotron / reasoning models need headroom beyond answer tokens. */
export function isReasoningModel(model: string): boolean {
  return /nemotron|reasoning|o1|o3|r1|think|claude-sonnet-4\.6/i.test(model);
}

/**
 * Effective completion budget. Reasoning models burn tokens on thinking —
 * keep max_tokens strictly above a reserved reasoning budget.
 */
export function resolveMaxTokens(model: string, requested?: number): number {
  const cfg = getCachedModelConfig();
  const base = requested ?? cfg.doctrineMaxTokens ?? 2000;
  if (!isReasoningModel(model)) return base;
  const floor = cfg.reasoningMaxTokens || 8192;
  return Math.max(base, floor);
}

/**
 * OpenRouter unified reasoning controls for chat completions.
 * Providers reject requests that set both `effort` and `max_tokens` —
 * send effort only (portable across reasoning models).
 */
export function reasoningRequestParams(model: string): Record<string, unknown> | null {
  if (!isReasoningModel(model)) return null;
  const cfg = getCachedModelConfig();
  return {
    reasoning: {
      effort: cfg.reasoningEffort || "low",
    },
  };
}

export function resolveTemperature(): number {
  return getCachedModelConfig().temperature;
}

export function resolveTimeoutMs(): number {
  return getCachedModelConfig().timeoutMs;
}

export function resolveMaxConcurrent(): number {
  return getCachedModelConfig().maxConcurrent;
}

export function resolveDoctrineMaxTokens(depth?: AnalysisDepth): number {
  const base = getCachedModelConfig().doctrineMaxTokens;
  if (!depth) return base;
  return Math.max(512, Math.round(base * depthTokenMultiplier(depth)));
}

export { envMockDefault };

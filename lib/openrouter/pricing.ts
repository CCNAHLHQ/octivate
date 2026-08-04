import { MODEL_RATES } from "./client";

export type CostSource = "openrouter" | "estimate" | "mixed";

/** Rough $/1M blended when the model id is unknown but clearly paid. */
function heuristicRate(model: string): number {
  if (/claude/i.test(model)) return 3;
  if (/gpt-4o|o1|o3|gpt-4\.1/i.test(model)) return 5;
  if (/gemini/i.test(model)) return 1.25;
  if (/deepseek/i.test(model)) return 0.5;
  if (/kimi|moonshot/i.test(model)) return 2;
  if (/mistral|mixtral/i.test(model)) return 0.25;
  if (/qwen/i.test(model)) return 0.2;
  if (/nemotron/i.test(model)) return 0;
  return 0.5;
}

/** Resolve estimated $/1M tokens for a model id. Free-tier suffixes bill as $0. */
export function resolveModelRate(model: string): number {
  const id = (model || "").trim();
  if (!id) return 0.5;
  if (/:free\b/i.test(id) || id.endsWith("/free")) return 0;
  if (MODEL_RATES[id] != null) return MODEL_RATES[id];
  for (const [key, rate] of Object.entries(MODEL_RATES)) {
    if (id === key || id.startsWith(`${key}:`) || id.includes(key)) return rate;
  }
  return heuristicRate(id);
}

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/**
 * Pull billed USD from an OpenRouter usage object.
 * Prefer `usage.cost` (account charge). Fall back to total_cost / cost_details.
 */
export function extractOpenRouterBilledUsd(usage: unknown): number | null {
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Record<string, unknown>;

  const direct = asFiniteNumber(u.cost) ?? asFiniteNumber(u.total_cost);
  if (direct != null) return Number(direct.toFixed(8));

  const details = u.cost_details;
  if (details && typeof details === "object") {
    const d = details as Record<string, unknown>;
    const upstream = asFiniteNumber(d.upstream_inference_cost);
    if (upstream != null) return Number(upstream.toFixed(8));
    const prompt = asFiniteNumber(d.upstream_inference_prompt_cost) ?? 0;
    const completion = asFiniteNumber(d.upstream_inference_completions_cost) ?? 0;
    const sum = prompt + completion;
    if (sum > 0) return Number(sum.toFixed(8));
  }
  return null;
}

export function estimateFromRates(model: string, totalTokens: number): number {
  const tokens = Math.max(0, totalTokens || 0);
  return Number(((tokens / 1_000_000) * resolveModelRate(model)).toFixed(8));
}

/**
 * Prefer OpenRouter-native billed cost; otherwise estimate from local rates.
 */
export function resolveCompletionCost(opts: {
  model: string;
  totalTokens: number;
  usage?: unknown;
  generationCost?: number | null;
}): { costUsd: number; costSource: CostSource } {
  const billed =
    extractOpenRouterBilledUsd(opts.usage) ??
    asFiniteNumber(opts.generationCost);
  if (billed != null) {
    return { costUsd: Number(billed.toFixed(6)), costSource: "openrouter" };
  }
  return {
    costUsd: Number(estimateFromRates(opts.model, opts.totalTokens).toFixed(6)),
    costSource: "estimate",
  };
}

/** @deprecated use resolveCompletionCost */
export function estimateCostUsd(
  model: string,
  totalTokens: number,
  nativeCost?: number | null
): number {
  return resolveCompletionCost({
    model,
    totalTokens,
    generationCost: nativeCost,
  }).costUsd;
}

export function mergeCostSource(
  current: CostSource | undefined,
  next: CostSource | undefined
): CostSource {
  if (!current) return next || "estimate";
  if (!next) return current;
  if (current === next) return current;
  return "mixed";
}

export function isPremiumModelId(model: string, premiumModel: string | null | undefined): boolean {
  if (!model || !premiumModel) return false;
  return model === premiumModel || model.startsWith(premiumModel);
}

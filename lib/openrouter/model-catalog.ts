/**
 * Curated OpenRouter model IDs + blended $/1M estimate rates.
 * DeepSeek V4.1 Flash is not a separate OpenRouter slug — use deepseek/deepseek-v4-flash.
 */

export const DEEPSEEK_MODELS = [
  "deepseek/deepseek-v4-flash",
  "deepseek/deepseek-v4-pro",
  "deepseek/deepseek-chat",
  "deepseek/deepseek-v3.2",
  "deepseek/deepseek-v3.2-exp",
  "deepseek/deepseek-chat-v3.1",
  "deepseek/deepseek-v3.1-terminus",
  "deepseek/deepseek-chat-v3-0324",
  "deepseek/deepseek-r1",
  "deepseek/deepseek-r1-0528",
  "deepseek/deepseek-r1-distill-llama-70b",
] as const;

export const KIMI_MODELS = [
  "moonshotai/kimi-k3",
  "moonshotai/kimi-k2.7-code",
  "moonshotai/kimi-k2.6",
  "moonshotai/kimi-k2.5",
  "moonshotai/kimi-k2-thinking",
  "moonshotai/kimi-k2-0905",
  "moonshotai/kimi-k2",
  "~moonshotai/kimi-latest",
] as const;

/** Blended $/1M from OpenRouter prompt+completion midpoints (Jul 2026). */
export const CATALOG_MODEL_RATES: Record<string, number> = {
  "deepseek/deepseek-v4-flash": 0.21,
  "deepseek/deepseek-v4-pro": 0.6525,
  "deepseek/deepseek-chat": 0.643,
  "deepseek/deepseek-v3.2": 0.3345,
  "deepseek/deepseek-v3.2-exp": 0.34,
  "deepseek/deepseek-chat-v3.1": 0.6,
  "deepseek/deepseek-v3.1-terminus": 0.635,
  "deepseek/deepseek-chat-v3-0324": 0.695,
  "deepseek/deepseek-r1": 1.6,
  "deepseek/deepseek-r1-0528": 1.325,
  "deepseek/deepseek-r1-distill-llama-70b": 0.8,
  "moonshotai/kimi-k3": 9,
  "moonshotai/kimi-k2.7-code": 2.115,
  "moonshotai/kimi-k2.6": 1.683,
  "moonshotai/kimi-k2.5": 1.71,
  "moonshotai/kimi-k2-thinking": 1.55,
  "moonshotai/kimi-k2-0905": 1.55,
  "moonshotai/kimi-k2": 1.435,
  "~moonshotai/kimi-latest": 8.95,
};

export function catalogModelIds(): string[] {
  return [...DEEPSEEK_MODELS, ...KIMI_MODELS];
}

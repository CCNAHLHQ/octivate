import { LiveOpenRouterClient } from "./live-client";
import { CATALOG_MODEL_RATES } from "./model-catalog";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  model?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  /** Prefer provider JSON object mode when supported. */
  jsonMode?: boolean;
}

export interface CompletionResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** USD charged for this completion (OpenRouter billed when available). */
  costUsd: number;
  /** Whether cost came from OpenRouter billing or a local rate estimate. */
  costSource: "openrouter" | "estimate" | "mixed";
  /** OpenRouter generation id for audit / generation lookup. */
  generationId?: string;
  /** Provider finish reason (e.g. stop | length). */
  finishReason?: string | null;
}

/** Approximate pricing per 1M tokens (input/output blended). */
export const MODEL_RATES: Record<string, number> = {
  "nvidia/nemotron-3.5-lightning:free": 0,
  "nvidia/nemotron-3.5-lightning": 0.14,
  "nvidia/nemotron-3-super-120b-a12b:free": 0,
  "nvidia/nemotron-3-ultra-550b-a55b:free": 0,
  "nvidia/nemotron-3-nano-30b-a3b:free": 0,
  "deepseek-chat": 0.643,
  "qwen-2.5": 0.2,
  mistral: 0.25,
  gemma: 0.15,
  "claude-sonnet": 3.0,
  "anthropic/claude-sonnet-4": 3.0,
  "anthropic/claude-sonnet-4.6": 3.0,
  "openai/gpt-4o": 5.0,
  "gpt-4o": 5.0,
  "google/gemini-2.5-pro": 1.25,
  ...CATALOG_MODEL_RATES,
};

export interface OpenRouterClient {
  complete(req: CompletionRequest): Promise<CompletionResult>;
}

let client: OpenRouterClient | null = null;

export function getOpenRouterClient(): OpenRouterClient {
  if (!client) {
    client = new LiveOpenRouterClient();
  }
  return client;
}

export function resetOpenRouterClient(): void {
  client = null;
}

import type { CompletionRequest, CompletionResult, OpenRouterClient } from "./client";
import {
  DEFAULT_OPENROUTER_MODEL,
  getFallbackOpenRouterModel,
  reasoningRequestParams,
  resolveMaxTokens,
  resolveTemperature,
  resolveTimeoutMs,
} from "./config";
import { resolveCompletionCost } from "./pricing";
import {
  describeChoice,
  extractJsonCandidate,
  extractMessageText,
  type OpenRouterMessage,
} from "./extract";
import { logOpenRouter } from "./log";
import { withLlmSlot, withRetry } from "@/lib/llm/concurrency";
import { getCachedModelConfig } from "./model-config-store";

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

interface OpenRouterResponse {
  id?: string;
  choices?: {
    finish_reason?: string;
    native_finish_reason?: string;
    message?: OpenRouterMessage;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    /** OpenRouter native USD cost charged to the account. */
    cost?: number | string;
    total_cost?: number | string;
    cost_details?: {
      upstream_inference_cost?: number | string;
      upstream_inference_prompt_cost?: number | string;
      upstream_inference_completions_cost?: number | string;
    };
    completion_tokens_details?: { reasoning_tokens?: number };
  };
  model?: string;
  error?: { message?: string };
}

async function fetchGenerationCost(
  generationId: string,
  apiKey: string
): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const res = await fetch(
      `https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(generationId)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      }
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: {
        total_cost?: number | string;
        usage?: number | string;
        native_tokens_prompt?: number;
        native_tokens_completion?: number;
      };
    };
    const d = body.data;
    if (!d) return null;
    const raw = d.total_cost ?? d.usage;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export class EmptyResponseError extends Error {
  model: string;
  finishReason: string | null;
  meta: ReturnType<typeof describeChoice>;

  constructor(
    model: string,
    finishReason: string | null,
    meta: ReturnType<typeof describeChoice>
  ) {
    super(
      `OpenRouter returned an empty response (model: ${model}` +
        `${finishReason ? `, finish_reason: ${finishReason}` : ""})`
    );
    this.name = "EmptyResponseError";
    this.model = model;
    this.finishReason = finishReason;
    this.meta = meta;
  }
}

class RetryAfterError extends Error {
  retryAfterMs: number | null;
  status: number;
  constructor(message: string, status: number, retryAfterMs: number | null) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export class LiveOpenRouterClient implements OpenRouterClient {
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const cfg = getCachedModelConfig();
    const primary = req.model || cfg.defaultModel || DEFAULT_OPENROUTER_MODEL;
    const fallback = getFallbackOpenRouterModel();

    return withLlmSlot(async () => {
      try {
        return await withRetry(
          () => this.completeOnce({ ...req, model: primary }, { skipReasoning: false }),
          {
            maxAttempts: 3,
            baseDelayMs: 1200,
            getRetryAfterMs: (err) =>
              err instanceof RetryAfterError ? err.retryAfterMs : null,
          }
        );
      } catch (err) {
        const empty = err instanceof EmptyResponseError;
        const soft =
          empty ||
          /empty response|timed out|429|503|rate limit/i.test(
            err instanceof Error ? err.message : String(err)
          );
        if (!soft || !fallback || fallback === primary) throw err;

        logOpenRouter({
          event: "fallback_model",
          model: primary,
          fallback,
          detail: err instanceof Error ? err.message : String(err),
        });

        return withRetry(
          () => this.completeOnce({ ...req, model: fallback }, { skipReasoning: false }),
          {
            maxAttempts: 2,
            baseDelayMs: 1500,
            getRetryAfterMs: (e) =>
              e instanceof RetryAfterError ? e.retryAfterMs : null,
          }
        );
      }
    });
  }

  private async completeOnce(
    req: CompletionRequest,
    opts: { skipReasoning?: boolean } = {}
  ): Promise<CompletionResult> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

    const cfg = getCachedModelConfig();
    const model = req.model || cfg.defaultModel || DEFAULT_OPENROUTER_MODEL;
    const maxTokens = resolveMaxTokens(model, req.maxTokens);
    const timeoutMs = resolveTimeoutMs();
    const temperature = resolveTemperature();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const reasoning = opts.skipReasoning ? null : reasoningRequestParams(model);

    let res: Response;
    try {
      res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://octivate.io",
          "X-Title": "Octivate",
        },
        body: JSON.stringify({
          model,
          messages: req.messages,
          max_tokens: maxTokens,
          temperature,
          ...(reasoning || {}),
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error(
          `OpenRouter request timed out after ${Math.round(timeoutMs / 1000)}s (model: ${model})`
        );
      }
      throw err instanceof Error ? err : new Error("OpenRouter request failed");
    } finally {
      clearTimeout(timer);
    }

    const retryAfterHeader = res.headers.get("Retry-After");
    const retryAfterMs = retryAfterHeader
      ? Number(retryAfterHeader) * 1000 || null
      : null;
    const requestId = res.headers.get("x-request-id") || res.headers.get("X-Request-Id");

    const data = (await res.json()) as OpenRouterResponse;
    if (!res.ok) {
      const message = data.error?.message || `OpenRouter error (${res.status})`;
      logOpenRouter({
        event: "http_error",
        model,
        status: res.status,
        detail: message,
        requestId,
      });
      // Some providers reject unified reasoning params — retry once without them.
      if (res.status === 400 && reasoning && /reasoning|effort|budget/i.test(message)) {
        logOpenRouter({
          event: "retry_without_reasoning",
          model,
          detail: message,
          requestId,
        });
        return this.completeOnce({ ...req, model }, { skipReasoning: true });
      }
      if (res.status === 429 || res.status === 503) {
        throw new RetryAfterError(message, res.status, retryAfterMs);
      }
      throw new Error(message);
    }

    const choice = data.choices?.[0];
    const meta = describeChoice(choice);
    const extracted = extractMessageText(choice?.message);
    let content = extracted.text;

    // If the model only returned reasoning, prefer a JSON object embedded in it.
    if (extracted.source !== "content" && content) {
      const json = extractJsonCandidate(content);
      if (json) content = json;
      logOpenRouter({
        event: "recovered_from_reasoning",
        model: data.model || model,
        source: extracted.source,
        contentLen: content.length,
        reasoningLen: meta.reasoningLen,
        finishReason: meta.finishReason,
        messageKeys: meta.messageKeys,
        requestId,
      });
    }

    if (!content.trim()) {
      logOpenRouter({
        event: "empty_response",
        model: data.model || model,
        status: res.status,
        finishReason: meta.finishReason,
        contentLen: meta.contentLen,
        reasoningLen: meta.reasoningLen,
        messageKeys: meta.messageKeys,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        requestId,
        detail:
          data.usage?.completion_tokens_details?.reasoning_tokens != null
            ? `reasoning_tokens=${data.usage.completion_tokens_details.reasoning_tokens}`
            : undefined,
      });
      throw new EmptyResponseError(data.model || model, meta.finishReason, meta);
    }

    if (process.env.OPENROUTER_DEBUG === "1") {
      logOpenRouter({
        event: "ok",
        model: data.model || model,
        finishReason: meta.finishReason,
        contentLen: content.length,
        source: extracted.source,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        requestId,
      });
    }

    const resolvedModel = data.model || model;
    const promptTokens =
      data.usage?.prompt_tokens ?? estimateTokens(req.messages.map((m) => m.content).join("\n"));
    const completionTokens = data.usage?.completion_tokens ?? estimateTokens(content);
    const totalTokens = data.usage?.total_tokens ?? promptTokens + completionTokens;
    const generationId = typeof data.id === "string" ? data.id : undefined;

    let priced = resolveCompletionCost({
      model: resolvedModel,
      totalTokens,
      usage: data.usage,
    });

    // If the chat response omitted usage.cost, ask the generation endpoint (authoritative bill).
    if (priced.costSource === "estimate" && generationId) {
      const generationCost = await fetchGenerationCost(generationId, apiKey);
      if (generationCost != null) {
        priced = {
          costUsd: Number(generationCost.toFixed(6)),
          costSource: "openrouter",
        };
      }
    }

    if (process.env.OPENROUTER_DEBUG === "1") {
      logOpenRouter({
        event: "cost_resolved",
        model: resolvedModel,
        requestId: generationId || requestId,
        detail: `${priced.costSource}:${priced.costUsd}:tok=${totalTokens}`,
      });
    }

    return {
      content,
      model: resolvedModel,
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd: priced.costUsd,
      costSource: priced.costSource,
      generationId,
    };
  }
}

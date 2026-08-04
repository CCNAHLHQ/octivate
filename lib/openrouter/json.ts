import type { OpenRouterClient, CompletionRequest, CompletionResult } from "./client";
import { MODEL_RATES } from "./client";
import { extractJsonCandidate } from "./extract";
import { logOpenRouter } from "./log";
import { mergeCostSource, type CostSource } from "./pricing";

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function extractJson(text: string): string {
  return extractJsonCandidate(text) || text.trim();
}

export type CompletionSpend = {
  totalTokens: number;
  costUsd: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costSource: "openrouter" | "estimate" | "mixed";
  generationId?: string;
};

/** Thrown when JSON parse retries exhaust — still carries spent tokens/cost. */
export class JsonCompleteError extends Error {
  spend: CompletionSpend;

  constructor(message: string, spend: CompletionSpend) {
    super(message);
    this.name = "JsonCompleteError";
    this.spend = spend;
  }
}

export function getThrownCompletionSpend(err: unknown): CompletionSpend | null {
  if (err instanceof JsonCompleteError) return err.spend;
  if (err && typeof err === "object" && "spend" in err) {
    const spend = (err as { spend?: CompletionSpend }).spend;
    if (
      spend &&
      typeof spend.totalTokens === "number" &&
      typeof spend.costUsd === "number"
    ) {
      return spend;
    }
  }
  return null;
}

export async function completeJson<T>(
  client: OpenRouterClient,
  req: CompletionRequest,
  parse: (raw: unknown) => T
): Promise<{ data: T; result: CompletionResult }> {
  let lastError: Error | null = null;
  let spend: CompletionSpend = {
    totalTokens: 0,
    costUsd: 0,
    model: req.model || "",
    promptTokens: 0,
    completionTokens: 0,
    costSource: "openrouter",
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await client.complete({
      ...req,
      messages: [
        ...req.messages,
        ...(attempt > 0
          ? [
              {
                role: "user" as const,
                content:
                  attempt === 1
                    ? "Your previous response was not valid JSON. Return ONLY a single JSON object matching the schema. No markdown fences, no prose."
                    : "CRITICAL: Output a single minified JSON object only. Do not include reasoning, explanations, or code fences.",
              },
            ]
          : []),
      ],
    });

    const nextSource = mergeCostSource(
      spend.totalTokens > 0 ? spend.costSource : undefined,
      result.costSource
    ) as CostSource;

    spend = {
      totalTokens: spend.totalTokens + (result.totalTokens || 0),
      costUsd: Number((spend.costUsd + (result.costUsd || 0)).toFixed(6)),
      model: result.model || spend.model,
      promptTokens: spend.promptTokens + (result.promptTokens || 0),
      completionTokens: spend.completionTokens + (result.completionTokens || 0),
      costSource: nextSource === "mixed" ? "mixed" : nextSource,
      generationId: result.generationId || spend.generationId,
    };

    try {
      const json = extractJson(result.content);
      const parsed = parse(JSON.parse(json));
      return {
        data: parsed,
        result: {
          ...result,
          totalTokens: spend.totalTokens,
          costUsd: spend.costUsd,
          promptTokens: spend.promptTokens,
          completionTokens: spend.completionTokens,
          model: spend.model || result.model,
          costSource: spend.costSource,
          generationId: spend.generationId,
        },
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("JSON parse failed");
      logOpenRouter({
        event: "json_parse_retry",
        model: result.model,
        attempt: attempt + 1,
        contentLen: result.content.length,
        detail: lastError.message,
      });
    }
  }

  throw new JsonCompleteError(
    lastError?.message || "Failed to parse JSON from model",
    spend
  );
}

export { estimateTokens, MODEL_RATES };

import type { OpenRouterClient, CompletionRequest, CompletionResult } from "./client";
import { MODEL_RATES } from "./client";
import { coerceJsonText, inspectJsonCandidate } from "./extract";
import { logOpenRouter } from "./log";
import { mergeCostSource, type CostSource } from "./pricing";

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
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

export type JsonFailureKind =
  | "json_fence"
  | "json_truncated"
  | "json_invalid"
  | "json_schema";

/** Thrown when JSON parse retries exhaust — still carries spent tokens/cost. */
export class JsonCompleteError extends Error {
  spend: CompletionSpend;
  kind: JsonFailureKind;
  /** Operator-facing copy (safe for toasts / stage messages). */
  userMessage: string;
  /** Last raw model text (for audit / debug console). */
  rawContent?: string;
  finishReason?: string | null;

  constructor(
    message: string,
    spend: CompletionSpend,
    opts?: {
      kind?: JsonFailureKind;
      userMessage?: string;
      rawContent?: string;
      finishReason?: string | null;
    }
  ) {
    super(message);
    this.name = "JsonCompleteError";
    this.spend = spend;
    this.kind = opts?.kind || "json_invalid";
    this.userMessage =
      opts?.userMessage ||
      "The model returned an unreadable response. Try again, or shorten the question / documents.";
    this.rawContent = opts?.rawContent;
    this.finishReason = opts?.finishReason ?? null;
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

export function userFacingJsonError(err: unknown): string | null {
  if (err instanceof JsonCompleteError) return err.userMessage;
  return null;
}

function classifyParseFailure(
  detail: string,
  meta: ReturnType<typeof inspectJsonCandidate>,
  finishReason?: string | null
): { kind: JsonFailureKind; userMessage: string } {
  const truncated =
    meta.truncated ||
    /unterminated string|unexpected end|end of (?:json|data|input)/i.test(detail) ||
    finishReason === "length";

  if (truncated) {
    return {
      kind: "json_truncated",
      userMessage:
        "The model response was cut off before it finished (often happens with large documents). We will retry with a shorter answer — if it keeps failing, split the upload or use a smaller extract.",
    };
  }
  if (meta.strippedFence || /unexpected token ['`]|markdown|fence/i.test(detail)) {
    return {
      kind: "json_fence",
      userMessage:
        "The model wrapped its answer in markdown instead of plain JSON. Retrying automatically — if it persists, rerun the step.",
    };
  }
  return {
    kind: "json_invalid",
    userMessage:
      "The model returned invalid structured output. Retry the step; if it continues, reduce document size or simplify the question.",
  };
}

function retryHint(attempt: number, kind: JsonFailureKind): string {
  if (kind === "json_truncated") {
    return attempt === 1
      ? "Your previous JSON was truncated mid-string. Return a COMPLETE but SHORTER JSON object only — prioritize key fields, keep string values concise, no markdown fences."
      : "CRITICAL: Output a compact minified JSON object that fully closes all braces and strings. No prose, no fences, no trailing commentary.";
  }
  if (attempt === 1) {
    return "Your previous response was not valid JSON. Return ONLY a single JSON object matching the schema. No markdown fences, no prose.";
  }
  return "CRITICAL: Output a single minified JSON object only. Do not include reasoning, explanations, or code fences.";
}

export async function completeJson<T>(
  client: OpenRouterClient,
  req: CompletionRequest,
  parse: (raw: unknown) => T
): Promise<{ data: T; result: CompletionResult }> {
  let lastError: Error | null = null;
  let lastKind: JsonFailureKind = "json_invalid";
  let lastUserMessage =
    "The model returned an unreadable response. Try again, or shorten the question / documents.";
  let lastRawContent = "";
  let lastFinishReason: string | null = null;
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
      jsonMode: true,
      messages: [
        ...req.messages,
        ...(attempt > 0
          ? [
              {
                role: "user" as const,
                content: retryHint(attempt, lastKind),
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

    lastRawContent = result.content || "";
    lastFinishReason = result.finishReason ?? null;

    try {
      const { json, meta } = coerceJsonText(result.content);
      const classified = classifyParseFailure(
        "precheck",
        meta,
        result.finishReason
      );
      if (!meta.parseable && meta.truncated) {
        lastKind = classified.kind;
        lastUserMessage = classified.userMessage;
        lastError = new Error(
          result.finishReason === "length"
            ? "JSON truncated (finish_reason=length)"
            : "JSON truncated / unterminated"
        );
        logOpenRouter({
          event: "json_parse_retry",
          model: result.model,
          attempt: attempt + 1,
          contentLen: result.content.length,
          detail: `${lastError.message}; fence=${meta.strippedFence}`,
        });
        continue;
      }

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
      const detail = err instanceof Error ? err.message : "JSON parse failed";
      const meta = inspectJsonCandidate(result.content);
      const classified = classifyParseFailure(detail, meta, result.finishReason);
      lastKind = classified.kind;
      lastUserMessage = classified.userMessage;
      lastError = err instanceof Error ? err : new Error(detail);
      logOpenRouter({
        event: "json_parse_retry",
        model: result.model,
        attempt: attempt + 1,
        contentLen: result.content.length,
        detail: `${detail}; kind=${lastKind}; fence=${meta.strippedFence}; trunc=${meta.truncated}`,
      });
    }
  }

  throw new JsonCompleteError(lastError?.message || "Failed to parse JSON from model", spend, {
    kind: lastKind,
    userMessage: lastUserMessage,
    rawContent: lastRawContent,
    finishReason: lastFinishReason,
  });
}

/**
 * Parse a single model completion into a JSON object with the same fence/truncation
 * hardening used by completeJson (no retries — caller owns retry policy).
 */
export function parseModelJsonObject(raw: string): Record<string, unknown> {
  const { json, meta } = coerceJsonText(raw);
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Model did not return a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    const detail = err instanceof Error ? err.message : "JSON parse failed";
    const classified = classifyParseFailure(detail, meta, null);
    throw new JsonCompleteError(detail, {
      totalTokens: 0,
      costUsd: 0,
      model: "",
      promptTokens: 0,
      completionTokens: 0,
      costSource: "estimate",
    }, { ...classified, rawContent: raw });
  }
}

export { estimateTokens, MODEL_RATES };

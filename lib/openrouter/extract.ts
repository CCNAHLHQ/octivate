/**
 * Normalize OpenRouter / reasoning-model message payloads into usable text.
 * Nemotron Ultra often fills reasoning_* while leaving content empty when
 * max_tokens is consumed by thinking — we must not treat that as hard failure
 * without first extracting recoverable answer text / JSON.
 */

export type OpenRouterMessage = {
  role?: string;
  content?: unknown;
  reasoning?: unknown;
  reasoning_content?: unknown;
  refusal?: unknown;
};

export type ChoiceMeta = {
  finishReason: string | null;
  messageKeys: string[];
  contentLen: number;
  reasoningLen: number;
  hasJsonCandidate: boolean;
};

function fromContentParts(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object") {
        const p = part as { text?: unknown; content?: unknown; type?: string };
        if (typeof p.text === "string") return p.text;
        if (typeof p.content === "string") return p.content;
      }
      return "";
    })
    .join("");
}

function asText(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return fromContentParts(v);
  return "";
}

/** Prefer final answer content; fall back to reasoning / refusal if needed. */
export function extractMessageText(message: OpenRouterMessage | undefined | null): {
  text: string;
  source: "content" | "reasoning_content" | "reasoning" | "refusal" | "none";
} {
  if (!message) return { text: "", source: "none" };

  const content = fromContentParts(message.content).trim();
  if (content) return { text: content, source: "content" };

  const reasoningContent = asText(message.reasoning_content).trim();
  if (reasoningContent) return { text: reasoningContent, source: "reasoning_content" };

  const reasoning = asText(message.reasoning).trim();
  if (reasoning) return { text: reasoning, source: "reasoning" };

  const refusal = asText(message.refusal).trim();
  if (refusal) return { text: refusal, source: "refusal" };

  return { text: "", source: "none" };
}

/** Pull a JSON object string out of free-form model text (incl. reasoning dump). */
export function extractJsonCandidate(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const closedFence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const openFence = !closedFence
    ? trimmed.match(/```(?:json)?\s*([\s\S]+)$/i)
    : null;
  const body = (closedFence?.[1] || openFence?.[1] || trimmed).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const slice = body.slice(start, end + 1);
  try {
    JSON.parse(slice);
    return slice;
  } catch {
    return null;
  }
}

export function describeChoice(
  choice: { finish_reason?: string; native_finish_reason?: string; message?: OpenRouterMessage } | undefined
): ChoiceMeta {
  const msg = choice?.message;
  const content = fromContentParts(msg?.content);
  const reasoning = asText(msg?.reasoning_content) || asText(msg?.reasoning);
  const json = extractJsonCandidate(content) || extractJsonCandidate(reasoning);
  return {
    finishReason: choice?.finish_reason || choice?.native_finish_reason || null,
    messageKeys: msg && typeof msg === "object" ? Object.keys(msg) : [],
    contentLen: content.length,
    reasoningLen: reasoning.length,
    hasJsonCandidate: Boolean(json),
  };
}

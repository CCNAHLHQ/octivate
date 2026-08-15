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

export type JsonExtractResult = {
  /** Best-effort JSON object text (fences stripped). */
  text: string | null;
  /** Fence / prose wrappers were removed. */
  strippedFence: boolean;
  /** Slice looks truncated (unbalanced braces / open string). */
  truncated: boolean;
  /** JSON.parse succeeded on the candidate. */
  parseable: boolean;
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

/** Strip markdown code fences (complete or truncated). */
export function stripMarkdownFences(text: string): { body: string; stripped: boolean } {
  const trimmed = text.trim();
  if (!trimmed) return { body: "", stripped: false };

  const closed = trimmed.match(/^```(?:json|JSON)?\s*\r?\n?([\s\S]*?)\r?\n?```\s*$/);
  if (closed) return { body: closed[1].trim(), stripped: true };

  const open = trimmed.match(/^```(?:json|JSON)?\s*\r?\n?([\s\S]+)$/);
  if (open) return { body: open[1].replace(/\n?```\s*$/, "").trim(), stripped: true };

  const embedded = trimmed.match(/```(?:json|JSON)?\s*([\s\S]*?)```/i);
  if (embedded) return { body: embedded[1].trim(), stripped: true };

  return { body: trimmed, stripped: false };
}

function looksTruncatedJson(slice: string): boolean {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < slice.length; i++) {
    const ch = slice[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
  }
  return inString || depth > 0;
}

/**
 * Best-effort repair for truncated JSON objects: close open strings and braces.
 * Only used as a last resort before giving up — never invents keys/values.
 */
export function repairTruncatedJsonObject(slice: string): string | null {
  if (!slice.trim().startsWith("{")) return null;
  let s = slice.trim();
  // Drop trailing incomplete escape
  if (s.endsWith("\\")) s = s.slice(0, -1);

  let inString = false;
  let escape = false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth = Math.max(0, depth - 1);
  }

  if (inString) s += '"';
  // Trim dangling comma / colon before closing
  s = s.replace(/,\s*$/, "").replace(/:\s*$/, ':""');
  while (depth-- > 0) s += "}";

  try {
    JSON.parse(s);
    return s;
  } catch {
    return null;
  }
}

/** Pull a JSON object string out of free-form model text (incl. reasoning dump). */
export function inspectJsonCandidate(text: string): JsonExtractResult {
  const empty: JsonExtractResult = {
    text: null,
    strippedFence: false,
    truncated: false,
    parseable: false,
  };
  if (!text?.trim()) return empty;

  const { body, stripped } = stripMarkdownFences(text);
  const start = body.indexOf("{");
  if (start < 0) {
    return { ...empty, strippedFence: stripped };
  }

  const end = body.lastIndexOf("}");
  const slice =
    end > start ? body.slice(start, end + 1) : body.slice(start);
  const truncated = looksTruncatedJson(slice) || end <= start;

  try {
    JSON.parse(slice);
    return {
      text: slice,
      strippedFence: stripped,
      truncated: false,
      parseable: true,
    };
  } catch {
    if (truncated) {
      const repaired = repairTruncatedJsonObject(slice);
      if (repaired) {
        return {
          text: repaired,
          strippedFence: stripped,
          truncated: true,
          parseable: true,
        };
      }
    }
    return {
      text: slice,
      strippedFence: stripped,
      truncated,
      parseable: false,
    };
  }
}

/** Pull a JSON object string out of free-form model text (incl. reasoning dump). */
export function extractJsonCandidate(text: string): string | null {
  const inspected = inspectJsonCandidate(text);
  return inspected.parseable ? inspected.text : null;
}

/**
 * Normalize model output into parseable JSON text.
 * Always strips markdown fences — never returns raw ```json wrappers.
 */
export function coerceJsonText(text: string): {
  json: string;
  meta: JsonExtractResult;
} {
  const meta = inspectJsonCandidate(text);
  if (meta.text) return { json: meta.text, meta };
  const { body, stripped } = stripMarkdownFences(text);
  return {
    json: body,
    meta: {
      text: null,
      strippedFence: stripped,
      truncated: false,
      parseable: false,
    },
  };
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

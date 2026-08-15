import {
  toast,
  TOAST_ERROR_DURATION_MS,
  TOAST_WARNING_DURATION_MS,
  type ToastTone,
} from "@/components/ui/toast";

export type ActionFailureKind =
  | "rate_limit"
  | "concurrent_limit"
  | "token_limit"
  | "psn_gate"
  | "openrouter"
  | "auth"
  | "generic";

export type ClassifiedActionError = {
  kind: ActionFailureKind;
  message: string;
  tone: ToastTone;
  retryAfterSec?: number;
};

/** Classify pipeline / API failures for consistent toast + inline copy. */
export function classifyActionError(err: unknown): ClassifiedActionError {
  const raw =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err ?? "Something went wrong");
  const lower = raw.toLowerCase();
  const retryAfterSec =
    err && typeof err === "object" && "retryAfterSec" in err
      ? Number((err as { retryAfterSec?: number }).retryAfterSec) || undefined
      : undefined;

  if (
    /429|too many requests|rate limit/i.test(raw) ||
    lower.includes("rate limit")
  ) {
    return {
      kind: "rate_limit",
      message: retryAfterSec
        ? `Rate limited — try again in ~${retryAfterSec}s.`
        : "Rate limited — slow down and try again shortly.",
      tone: "warning",
      retryAfterSec,
    };
  }
  if (/concurrent agent limit/i.test(raw)) {
    return {
      kind: "concurrent_limit",
      message: raw,
      tone: "warning",
    };
  }
  if (/already running for this project/i.test(raw)) {
    return {
      kind: "concurrent_limit",
      message: "A workflow is already running here. Use Rerun workflow to replace it.",
      tone: "warning",
    };
  }
  if (/daily token|token limit/i.test(raw)) {
    return {
      kind: "token_limit",
      message: raw,
      tone: "warning",
    };
  }
  if (/psn synthesis gate/i.test(raw)) {
    return {
      kind: "psn_gate",
      message:
        "Octivate (octivate.io): we could not evidence Power, Systems, or Narrative findings for this theatre. That usually means the documents or question do not relate to the project’s country and sector. Add on-scope material or refine the question, then rerun — we will not invent coverage.",
      tone: "error",
    };
  }
  if (/json_truncated|unterminated string|cut off before it finished|finish_reason=length/i.test(raw)) {
    return {
      kind: "openrouter",
      message:
        "The model response was cut off — common with large documents. Split the file or rerun; we already retry with a shorter answer automatically.",
      tone: "error",
    };
  }
  if (
    /json_fence|markdown fences|unreadable response|invalid structured output|failed to parse json/i.test(
      raw
    )
  ) {
    return {
      kind: "openrouter",
      message:
        "Structured output failed after retries. Rerun the step; if it continues, shorten the document or question.",
      tone: "error",
    };
  }
  if (/openrouter|timed out|empty response/i.test(raw)) {
    const hint = /empty response/i.test(raw)
      ? " The model spent its token budget on thinking — we retry and fall back automatically; rerun if it persists."
      : "";
    return {
      kind: "openrouter",
      message: `${raw}${hint}`,
      tone: "error",
    };
  }
  if (/401|403|unauthorized|invalid credentials/i.test(raw)) {
    return {
      kind: "auth",
      message: "Authentication required or credentials invalid.",
      tone: "error",
    };
  }
  return { kind: "generic", message: raw || "Request failed", tone: "error" };
}

export function toastActionError(err: unknown) {
  const c = classifyActionError(err);
  const durationMs =
    c.tone === "error"
      ? TOAST_ERROR_DURATION_MS
      : c.tone === "warning"
        ? TOAST_WARNING_DURATION_MS
        : undefined;
  toast(c.message, c.tone, { durationMs });
  return c;
}

export function pipelineFailureHint(sessionError?: string | null): string {
  if (!sessionError) {
    return "The workflow did not complete. Rerun to try again.";
  }
  return classifyActionError(new Error(sessionError)).message;
}

/**
 * Structured OpenRouter diagnostics — never logs API keys or full prompts.
 * Always warn on empty/soft failures; verbose when OPENROUTER_DEBUG=1.
 * Dual-writes into the unified ops event log.
 */

import { emitOpsEvent } from "@/lib/ops/event-log";

export type OpenRouterLogEvent = {
  event: string;
  model?: string;
  status?: number;
  finishReason?: string | null;
  contentLen?: number;
  reasoningLen?: number;
  messageKeys?: string[];
  source?: string;
  attempt?: number;
  fallback?: string;
  promptTokens?: number;
  completionTokens?: number;
  requestId?: string | null;
  detail?: string;
};

export function logOpenRouter(evt: OpenRouterLogEvent) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    svc: "openrouter",
    ...evt,
  });
  const severe =
    /empty|fail|error|fallback|retry/i.test(evt.event) ||
    (typeof evt.contentLen === "number" && evt.contentLen === 0);

  void emitOpsEvent({
    level: severe ? "warn" : "debug",
    source: "openrouter",
    message: evt.event + (evt.model ? ` · ${evt.model}` : ""),
    meta: { ...evt },
  });

  if (severe || process.env.OPENROUTER_DEBUG === "1") {
    // eslint-disable-next-line no-console
    console.warn(line);
  }
}

/**
 * Full-fidelity workspace pipeline failure recorder for audit + live debug console.
 * Keeps operator-safe redaction of secrets while preserving raw model text, stacks,
 * stage snapshots, and spend — enough to diagnose and correct systems later.
 */

import { appendAudit } from "@/lib/protocol/audit";
import { emitOpsEvent } from "@/lib/ops/event-log";
import { JsonCompleteError, getThrownCompletionSpend } from "@/lib/openrouter/json";
import type { AgentSession, AgentStage } from "@/lib/types";

/** Cap huge model dumps so audit/ops stores stay usable (still “full” for debug). */
export const PIPELINE_FAILURE_CONTENT_CAP = 96_000;

export type WorkspaceFailureKind =
  | "pipeline_failed"
  | "pipeline_stale_timeout"
  | "pipeline_superseded"
  | "pipeline_start_failed"
  | "document_summarize_failed";

function clip(value: string, cap = PIPELINE_FAILURE_CONTENT_CAP): string {
  if (value.length <= cap) return value;
  return `${value.slice(0, cap)}\n…[truncated ${value.length - cap} chars]`;
}

function safeJson(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function stageSnapshot(stages?: AgentStage[]) {
  if (!stages?.length) return undefined;
  return stages.map((s) => ({
    name: s.name,
    status: s.status,
    progress: s.progress,
    message: s.message,
    outputStatus: s.outputStatus,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
  }));
}

/** Extract every diagnostic field we can from thrown pipeline / LLM errors. */
export function extractErrorDiagnostics(err: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (err == null) {
    out.message = "Unknown error";
    return out;
  }

  if (err instanceof Error) {
    out.name = err.name;
    out.message = err.message;
    if (err.stack) out.stack = clip(err.stack, 24_000);
  } else {
    out.message = String(err);
  }

  if (err instanceof JsonCompleteError) {
    out.kind = err.kind;
    out.userMessage = err.userMessage;
    out.spend = err.spend;
    if (err.rawContent) out.rawContent = clip(err.rawContent);
    if (err.finishReason) out.finishReason = err.finishReason;
  }

  if (err && typeof err === "object" && (err as Error).name === "EmptyResponseError") {
    const empty = err as {
      model?: string;
      finishReason?: string | null;
      meta?: unknown;
    };
    out.model = empty.model;
    out.finishReason = empty.finishReason;
    out.choiceMeta = safeJson(empty.meta);
  }

  const spend = getThrownCompletionSpend(err);
  if (spend && !out.spend) out.spend = spend;

  if (err && typeof err === "object") {
    const anyErr = err as Record<string, unknown>;
    for (const key of [
      "code",
      "status",
      "statusCode",
      "finishReason",
      "rawContent",
      "content",
      "response",
      "body",
      "cause",
      "detail",
      "details",
    ] as const) {
      if (anyErr[key] == null || out[key] != null) continue;
      const v = anyErr[key];
      if (typeof v === "string") out[key] = clip(v);
      else if (v instanceof Error) {
        out[key] = { name: v.name, message: v.message, stack: v.stack ? clip(v.stack, 12_000) : undefined };
      } else out[key] = safeJson(v);
    }
  }

  return out;
}

export type RecordWorkspaceFailureInput = {
  action: WorkspaceFailureKind;
  message: string;
  session?: Pick<
    AgentSession,
    | "id"
    | "projectId"
    | "question"
    | "status"
    | "stages"
    | "modelUsed"
    | "analysisDepth"
    | "pipelineMode"
    | "tokensUsed"
    | "estimatedCostUsd"
    | "decisionId"
    | "workflowState"
    | "preferPremium"
    | "usedPremium"
    | "localOnlySources"
    | "startedAt"
    | "updatedAt"
    | "completedAt"
    | "error"
    | "errorDetail"
  >;
  projectId?: string;
  sessionId?: string;
  briefId?: string;
  docId?: string;
  docName?: string;
  stage?: string;
  err?: unknown;
  /** Extra operator context (prompts summaries, gate names, etc.). */
  extra?: Record<string, unknown>;
  level?: "error" | "warn" | "info";
};

/**
 * Dual-write: durable audit-log row + live ops debug event with full meta.
 */
export async function recordWorkspaceFailure(input: RecordWorkspaceFailureInput): Promise<void> {
  const diagnostics = input.err != null ? extractErrorDiagnostics(input.err) : {};
  const session = input.session;
  const sessionId = input.sessionId || session?.id;
  const projectId = input.projectId || session?.projectId;

  const payload: Record<string, unknown> = {
    action: input.action,
    at: new Date().toISOString(),
    message: input.message,
    sessionId,
    projectId,
    briefId: input.briefId,
    docId: input.docId,
    docName: input.docName,
    stage: input.stage || session?.errorDetail?.stage || session?.stages?.find((s) => s.status === "failed")?.name,
    session: session
      ? {
          id: session.id,
          projectId: session.projectId,
          status: session.status,
          question: session.question,
          modelUsed: session.modelUsed,
          analysisDepth: session.analysisDepth,
          pipelineMode: session.pipelineMode,
          tokensUsed: session.tokensUsed,
          estimatedCostUsd: session.estimatedCostUsd,
          decisionId: session.decisionId,
          workflowState: session.workflowState,
          preferPremium: session.preferPremium,
          usedPremium: session.usedPremium,
          localOnlySources: session.localOnlySources,
          startedAt: session.startedAt,
          updatedAt: session.updatedAt,
          completedAt: session.completedAt,
          error: session.error,
          errorDetail: session.errorDetail,
          stages: stageSnapshot(session.stages),
        }
      : undefined,
    error: diagnostics,
    extra: input.extra ? safeJson(input.extra) : undefined,
  };

  // Drop undefined keys for cleaner JSON
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key];
  }

  const detail = clip(JSON.stringify(payload));

  await appendAudit({
    action: input.action,
    sessionId,
    briefId: input.briefId,
    detail,
  });

  // appendAudit also emits a truncated ops line for generic audit — emit a full pipeline event.
  void emitOpsEvent({
    level: input.level || (input.action === "pipeline_superseded" ? "info" : "error"),
    source: "pipeline",
    message: `${input.action} · ${input.message}`,
    meta: payload,
    fullContent: true,
  });
}

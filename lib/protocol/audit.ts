import { readCollection, writeCollection, uid } from "@/lib/store/json-store";
import { emitOpsEvent } from "@/lib/ops/event-log";
import type { AuditLogEntry } from "@/lib/types";

export async function appendAudit(entry: Omit<AuditLogEntry, "id" | "at">): Promise<void> {
  const log = await readCollection<AuditLogEntry>("audit-log", []);
  const row: AuditLogEntry = {
    id: uid("audit"),
    at: new Date().toISOString(),
    ...entry,
  };
  log.unshift(row);
  await writeCollection("audit-log", log.slice(0, 500));

  const isFailure = /fail|error|reject|timeout|stale/i.test(entry.action);
  const detail = entry.detail ? String(entry.detail) : "";
  // Prefer structured full payload in meta when detail is JSON; keep message scannable.
  let metaDetail: unknown = detail || undefined;
  if (detail && (detail.startsWith("{") || detail.startsWith("["))) {
    try {
      metaDetail = JSON.parse(detail) as unknown;
    } catch {
      metaDetail = detail;
    }
  }

  void emitOpsEvent({
    level: isFailure ? "warn" : "info",
    source: "audit",
    message: entry.action + (detail && !isFailure ? ` — ${detail.slice(0, 240)}` : detail ? ` — ${detail.slice(0, 480)}` : ""),
    meta: {
      sessionId: entry.sessionId,
      briefId: entry.briefId,
      action: entry.action,
      detail: metaDetail,
      outputHash: entry.outputHash,
    },
    fullContent: isFailure,
  });
}

export function hashOutput(data: unknown): string {
  const str = JSON.stringify(data);
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return `h${Math.abs(h).toString(16)}`;
}

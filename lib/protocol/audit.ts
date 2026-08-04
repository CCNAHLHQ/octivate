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

  void emitOpsEvent({
    level: /fail|error|reject/i.test(entry.action) ? "warn" : "info",
    source: "audit",
    message: entry.action + (entry.detail ? ` — ${String(entry.detail).slice(0, 240)}` : ""),
    meta: {
      sessionId: entry.sessionId,
      briefId: entry.briefId,
      action: entry.action,
    },
  });
}

export function hashOutput(data: unknown): string {
  const str = JSON.stringify(data);
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return `h${Math.abs(h).toString(16)}`;
}

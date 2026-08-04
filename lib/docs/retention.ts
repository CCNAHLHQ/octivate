import { appendAudit } from "@/lib/protocol/audit";
import { SEED_PROJECTS } from "@/lib/mock/seed";
import { readCollection, uid, writeCollection } from "@/lib/store/json-store";
import type { DocDeletionQueueItem, Project } from "@/lib/types";

/** Local shape — avoid importing store (circular with delete helpers). */
type ProjectDocument = Project["documents"][number] & { changedAt?: string };

const QUEUE = "doc-deletion-queue";
const DAY_MS = 24 * 60 * 60 * 1000;

let processing = false;
let lastSweepAt = 0;
const SWEEP_MIN_INTERVAL_MS = 60_000;

export function retentionExpiryIso(fromIso: string, days: number): string {
  const base = Date.parse(fromIso);
  const start = Number.isFinite(base) ? base : Date.now();
  const safeDays = Math.min(3650, Math.max(1, Math.round(days) || 30));
  return new Date(start + safeDays * DAY_MS).toISOString();
}

/** Retention clock: last material change, else upload time. */
export function documentRetentionAnchor(doc: Pick<ProjectDocument, "uploadedAt"> & {
  changedAt?: string;
}): string {
  return doc.changedAt || doc.uploadedAt;
}

export function computeDocumentExpiresAt(
  doc: Pick<ProjectDocument, "uploadedAt"> & { changedAt?: string },
  days: number
): string {
  return retentionExpiryIso(documentRetentionAnchor(doc), days);
}

async function readQueue(): Promise<DocDeletionQueueItem[]> {
  return readCollection<DocDeletionQueueItem>(QUEUE, []);
}

async function writeQueue(items: DocDeletionQueueItem[]): Promise<void> {
  await writeCollection(QUEUE, items.slice(0, 2_000));
}

function pendingKey(projectId: string, docId: string): string {
  return `${projectId}:${docId}`;
}

async function enqueueDeletion(opts: {
  projectId: string;
  doc: ProjectDocument;
  reason: DocDeletionQueueItem["reason"];
}): Promise<boolean> {
  const queue = await readQueue();
  const key = pendingKey(opts.projectId, opts.doc.id);
  const already = queue.some(
    (q) =>
      q.status === "pending" &&
      pendingKey(q.projectId, q.docId) === key
  );
  if (already) return false;

  const item: DocDeletionQueueItem = {
    id: uid("docq"),
    projectId: opts.projectId,
    docId: opts.doc.id,
    docName: opts.doc.name,
    reason: opts.reason,
    expiresAt: opts.doc.expiresAt || new Date().toISOString(),
    queuedAt: new Date().toISOString(),
    status: "pending",
  };
  queue.unshift(item);
  await writeQueue(queue);
  return true;
}

/**
 * Recompute expiresAt for every project document from the retention anchor + days.
 * Documents already past due are queued for deletion.
 */
export async function applyDocumentRetentionPolicy(opts: {
  days: number;
  previousDays?: number;
  sessionId?: string;
}): Promise<{
  recomputed: number;
  queued: number;
  unchanged: number;
}> {
  const days = Math.min(3650, Math.max(1, Math.round(opts.days) || 30));
  const projects = await readCollection<Project>("projects", SEED_PROJECTS);
  const now = Date.now();
  let recomputed = 0;
  let unchanged = 0;
  let queued = 0;

  for (let p = 0; p < projects.length; p++) {
    const project = projects[p];
    if (!project.documents?.length) continue;
    let touched = false;
    const docs = project.documents.map((raw) => {
      const doc = raw as ProjectDocument;
      const nextExpires = computeDocumentExpiresAt(doc, days);
      if (doc.expiresAt === nextExpires) {
        unchanged += 1;
        return doc;
      }
      recomputed += 1;
      touched = true;
      return { ...doc, expiresAt: nextExpires };
    });
    if (touched) {
      projects[p] = {
        ...project,
        documents: docs,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  await writeCollection("projects", projects);

  for (const project of projects) {
    for (const raw of project.documents || []) {
      const doc = raw as ProjectDocument;
      const exp = Date.parse(doc.expiresAt || "");
      if (!Number.isFinite(exp) || exp > now) continue;
      const enqueued = await enqueueDeletion({
        projectId: project.id,
        doc,
        reason:
          opts.previousDays !== undefined && opts.previousDays !== days
            ? "policy_recompute"
            : "retention_expired",
      });
      if (enqueued) queued += 1;
    }
  }

  await appendAudit({
    action: "data_retention_policy_applied",
    sessionId: opts.sessionId,
    detail:
      opts.previousDays !== undefined && opts.previousDays !== days
        ? `Retention ${opts.previousDays} → ${days} days; recomputed ${recomputed} docs; queued ${queued} for deletion`
        : `Retention ${days} days; recomputed ${recomputed} docs; queued ${queued} for deletion`,
  });

  return { recomputed, queued, unchanged };
}

/** Find currently expired documents and enqueue them (idempotent). */
export async function sweepExpiredDocuments(opts?: {
  sessionId?: string;
}): Promise<{ scanned: number; queued: number }> {
  const projects = await readCollection<Project>("projects", SEED_PROJECTS);
  const now = Date.now();
  let scanned = 0;
  let queued = 0;

  for (const project of projects) {
    for (const raw of project.documents || []) {
      const doc = raw as ProjectDocument;
      scanned += 1;
      const exp = Date.parse(doc.expiresAt || "");
      if (!Number.isFinite(exp) || exp > now) continue;
      const enqueued = await enqueueDeletion({
        projectId: project.id,
        doc,
        reason: "retention_expired",
      });
      if (enqueued) queued += 1;
    }
  }

  if (queued > 0) {
    await appendAudit({
      action: "document_retention_queued",
      sessionId: opts?.sessionId,
      detail: `Queued ${queued} expired document(s) for deletion (${scanned} scanned)`,
    });
  }

  return { scanned, queued };
}

/** Drain pending deletion queue: remove blob + metadata, audit each purge. */
export async function processDocumentDeletionQueue(opts?: {
  limit?: number;
  sessionId?: string;
}): Promise<{ processed: number; deleted: number; failed: number }> {
  if (processing) return { processed: 0, deleted: 0, failed: 0 };
  processing = true;
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 40));

  try {
    const { deleteProjectDocument } = await import("@/lib/docs/store");
    const queue = await readQueue();
    const pending = queue.filter((q) => q.status === "pending").slice(0, limit);
    let deleted = 0;
    let failed = 0;

    for (const item of pending) {
      const idx = queue.findIndex((q) => q.id === item.id);
      if (idx < 0) continue;
      try {
        await deleteProjectDocument(item.projectId, item.docId);
        queue[idx] = {
          ...queue[idx],
          status: "deleted",
          deletedAt: new Date().toISOString(),
          error: undefined,
        };
        deleted += 1;
        await appendAudit({
          action: "document_retention_deleted",
          sessionId: opts?.sessionId,
          detail: `Deleted "${item.docName}" (${item.docId}) from project ${item.projectId}; reason=${item.reason}; expired ${item.expiresAt}`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Already gone — treat as success.
        if (/not found/i.test(message)) {
          queue[idx] = {
            ...queue[idx],
            status: "deleted",
            deletedAt: new Date().toISOString(),
            error: undefined,
          };
          deleted += 1;
          await appendAudit({
            action: "document_retention_deleted",
            sessionId: opts?.sessionId,
            detail: `Already absent "${item.docName}" (${item.docId}); cleared from retention queue`,
          });
        } else {
          queue[idx] = {
            ...queue[idx],
            status: "failed",
            error: message.slice(0, 400),
          };
          failed += 1;
          await appendAudit({
            action: "document_retention_delete_failed",
            sessionId: opts?.sessionId,
            detail: `Failed deleting "${item.docName}" (${item.docId}): ${message.slice(0, 240)}`,
          });
        }
      }
    }

    await writeQueue(queue);
    return { processed: pending.length, deleted, failed };
  } finally {
    processing = false;
  }
}

/**
 * Periodic maintenance: enqueue overdue docs and drain the deletion queue.
 * Throttled when called from health probes (does not re-audit policy apply).
 */
export async function runDocumentRetentionMaintenance(opts?: {
  force?: boolean;
  sessionId?: string;
}): Promise<{
  skipped?: boolean;
  sweep?: { scanned: number; queued: number };
  process?: { processed: number; deleted: number; failed: number };
}> {
  const now = Date.now();
  if (!opts?.force && now - lastSweepAt < SWEEP_MIN_INTERVAL_MS) {
    return { skipped: true };
  }
  lastSweepAt = now;

  const sweep = await sweepExpiredDocuments({ sessionId: opts?.sessionId });
  const process = await processDocumentDeletionQueue({
    limit: 40,
    sessionId: opts?.sessionId,
  });
  return { sweep, process };
}

export async function countPendingDeletions(): Promise<number> {
  const queue = await readQueue();
  return queue.filter((q) => q.status === "pending").length;
}

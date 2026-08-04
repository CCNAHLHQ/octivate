import { appendAudit } from "@/lib/protocol/audit";
import { SEED_SOURCES } from "@/lib/mock/seed";
import { assertSafePublicUrl } from "@/lib/security/ssrf";
import { closeChromiumBrowser } from "@/lib/browser/chromium";
import { clearAllArtifactBundles } from "@/lib/sources/artifacts";
import { isCaptureRunnerAvailable } from "@/lib/sources/capture-runner";
import {
  advanceJob,
  beginJob,
  endJob,
  ensureJob,
  getJobProgress,
  setJobCurrent,
} from "@/lib/sources/job-progress";
import { readProbeConfig } from "@/lib/sources/probe-config";
import { readCollection, uid, writeCollection } from "@/lib/store/json-store";
import type { Source, SourceCaptureQueueItem } from "@/lib/types";

const QUEUE = "source-capture-queue";
/** Waves processed inside one HTTP request for resume/drain (client still loops). */
const WAVES_PER_REQUEST = 8;

export type CaptureEnqueueMode = "stale" | "all" | "one" | "drain" | "resume";

export type CaptureRunResult = {
  queued: number;
  recovered: number;
  processed: number;
  failed: number;
  succeeded: number;
  pending: number;
  reason?: string;
};

export async function readCaptureQueue(): Promise<SourceCaptureQueueItem[]> {
  return readCollection<SourceCaptureQueueItem>(QUEUE, []);
}

async function writeQueue(items: SourceCaptureQueueItem[]) {
  await writeCollection(QUEUE, items.slice(0, 500));
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function countOpen(queue: SourceCaptureQueueItem[]) {
  return queue.filter((q) => q.status === "pending" || q.status === "running").length;
}

/** Consider an in-memory capture job abandoned after this idle window. */
const STALE_JOB_MS = 2 * 60 * 1000;

/**
 * Reset orphaned `running` items back to `pending`.
 * Skips while a fresh capture job is mid-flight; Resume can force recovery.
 */
export async function recoverStuckCaptureItems(opts?: {
  force?: boolean;
}): Promise<number> {
  const job = getJobProgress("capture");
  const staleRunning =
    job.status === "running" &&
    Date.now() - new Date(job.updatedAt).getTime() > STALE_JOB_MS;

  if (job.status === "running" && !staleRunning && !opts?.force) return 0;

  if (staleRunning || (opts?.force && job.status === "running")) {
    endJob("capture", {
      label: "Capture interrupted — ready to resume",
    });
  }

  const queue = await readCaptureQueue();
  let recovered = 0;
  const next = queue.map((q) => {
    if (q.status !== "running") return q;
    recovered += 1;
    return {
      ...q,
      status: "pending" as const,
      error: undefined,
      finishedAt: undefined,
    };
  });
  if (!recovered) return 0;

  await writeQueue(next);
  await appendAudit({
    action: "source_capture_recovered",
    detail: `Re-queued ${recovered} stuck running capture(s) as pending`,
  });
  return recovered;
}

async function enqueueTargets(
  mode: "stale" | "all" | "one",
  sourceId?: string
): Promise<{ queued: number; pendingTotal: number }> {
  const sources = await readCollection<Source>("sources", SEED_SOURCES);
  let targets: Source[] = [];
  if (mode === "one") {
    const one = sources.find((s) => s.id === sourceId);
    if (!one) throw new Error("Source not found");
    targets = [one];
  } else if (mode === "all") {
    targets = sources.filter((s) => s.primaryRetrievalUrl || s.url);
  } else {
    targets = sources.filter(
      (s) => (s.primaryRetrievalUrl || s.url) && !s.lastCaptureAt
    );
  }

  const queue = await readCaptureQueue();
  const activeIds = new Set(
    queue
      .filter((q) => q.status === "pending" || q.status === "running")
      .map((q) => q.sourceId)
  );
  const now = new Date().toISOString();
  let queued = 0;

  for (const src of targets) {
    if (activeIds.has(src.id)) continue;
    const url = (src.primaryRetrievalUrl || src.url || "").trim();
    if (!url) continue;
    const safe = await assertSafePublicUrl(url);
    if (!safe.ok) {
      await appendAudit({
        action: "source_capture_failed",
        detail: `${src.title}: ${safe.code} — ${safe.detail}`,
      });
      continue;
    }
    queue.unshift({
      id: uid("capq"),
      sourceId: src.id,
      sourceTitle: src.title,
      url: safe.url.toString(),
      queuedAt: now,
      status: "pending",
    });
    activeIds.add(src.id);
    queued += 1;
  }

  await writeQueue(queue);
  return { queued, pendingTotal: countOpen(queue) };
}

/**
 * Enqueue and/or drain capture jobs through the Chromium runner.
 *
 * Modes:
 * - stale / all / one → enqueue then drain a polite multi-wave batch
 * - drain → process pending only (used by Capture-all client loop)
 * - resume → recover stuck running → pending, then drain leftovers
 */
export async function enqueueSourceCaptures(opts: {
  mode: CaptureEnqueueMode;
  sourceId?: string;
}): Promise<CaptureRunResult> {
  const cfg = await readProbeConfig();
  if (!cfg.captureEnabled) {
    await appendAudit({
      action: "source_capture_rejected",
      detail: "Capture requested while captureEnabled=false",
    });
    return emptyResult("capture_disabled");
  }

  if (!isCaptureRunnerAvailable()) {
    await appendAudit({
      action: "source_capture_rejected",
      detail: "Capture requested but Chromium/Edge is not available",
    });
    return emptyResult("chromium_not_found");
  }

  const isResume = opts.mode === "resume";
  const isDrainOnly = opts.mode === "drain" || isResume;

  // Recover crash leftovers before enqueue/drain. Resume forces unstick.
  const recovered = await recoverStuckCaptureItems({
    force: opts.mode === "resume",
  });

  let queued = 0;

  if (!isDrainOnly) {
    beginJob("capture", {
      total: 0,
      mode: opts.mode,
      label: "Queuing sources…",
      current: "Preparing capture queue",
    });
    const enqueued = await enqueueTargets(
      opts.mode as "stale" | "all" | "one",
      opts.sourceId
    );
    queued = enqueued.queued;
    ensureJob("capture", {
      total: enqueued.pendingTotal,
      mode: opts.mode,
      label: opts.mode === "all" ? "Capturing all sources" : "Capturing sources",
      current: "Starting capture wave…",
    });
    await appendAudit({
      action: "source_capture_queued",
      detail: `Queued ${queued} capture job(s) mode=${opts.mode}`,
    });
  } else if (isResume) {
    const queue = await readCaptureQueue();
    const open = countOpen(queue);
    if (!open) {
      return {
        queued: 0,
        recovered,
        processed: 0,
        failed: 0,
        succeeded: 0,
        pending: 0,
        reason: recovered ? undefined : "queue_empty",
      };
    }
    beginJob("capture", {
      total: open,
      mode: "resume",
      label: `Resuming ${open} pending capture(s)`,
      current: "Starting resume wave…",
    });
    await appendAudit({
      action: "source_capture_resumed",
      detail: `Resume capture · ${open} pending · ${recovered} recovered from stuck running`,
    });
  }

  const drained = await processCaptureQueue({
    continueJob: true,
    maxWaves: isResume || opts.mode === "drain" ? WAVES_PER_REQUEST : WAVES_PER_REQUEST,
  });

  return { queued, recovered, ...drained };
}

function emptyResult(reason: string): CaptureRunResult {
  return {
    queued: 0,
    recovered: 0,
    processed: 0,
    failed: 0,
    succeeded: 0,
    pending: 0,
    reason,
  };
}

/**
 * Drain pending capture jobs in polite waves (serial browser pages + domain gap).
 */
export async function processCaptureQueue(opts?: {
  continueJob?: boolean;
  maxWaves?: number;
}): Promise<{
  processed: number;
  failed: number;
  succeeded: number;
  pending: number;
  reason?: string;
}> {
  const cfg = await readProbeConfig();
  const maxWaves = Math.max(1, opts?.maxWaves ?? 1);

  if (!isCaptureRunnerAvailable()) {
    const queue = await readCaptureQueue();
    return {
      processed: 0,
      failed: 0,
      succeeded: 0,
      pending: countOpen(queue),
      reason: "chromium_not_found",
    };
  }

  const { runSourceCapture } = await import("@/lib/sources/capture-runner");
  const waveSize = Math.max(1, Math.min(cfg.batchSize, 5));

  let processed = 0;
  let failed = 0;
  let succeeded = 0;
  let pendingLeft = 0;

  for (let waveIdx = 0; waveIdx < maxWaves; waveIdx++) {
    const queue = await readCaptureQueue();
    const pendingAll = queue.filter((q) => q.status === "pending");
    pendingLeft = countOpen(queue);

    if (!pendingAll.length) {
      const running = getJobProgress("capture");
      if (running.status === "running") {
        endJob("capture", { label: running.label || "Capture complete" });
      }
      break;
    }

    const wave = pendingAll.slice(0, waveSize);

    if (opts?.continueJob || waveIdx > 0) {
      const cur = getJobProgress("capture");
      ensureJob("capture", {
        total: Math.max(cur.total, cur.done + pendingAll.length),
        mode: cur.mode || "wave",
        label: cur.label || "Capturing sources",
        current: wave[0]?.sourceTitle,
      });
    } else {
      beginJob("capture", {
        total: pendingAll.length,
        mode: "wave",
        label: `Capturing ${pendingAll.length} source(s)`,
        current: wave[0]?.sourceTitle,
      });
    }

    const sources = await readCollection<Source>("sources", SEED_SOURCES);
    const domainLastAt = new Map<string, number>();

    try {
      for (const item of wave) {
        const idx = queue.findIndex((q) => q.id === item.id);
        if (idx < 0) continue;
        queue[idx] = { ...queue[idx], status: "running" };
        await writeQueue(queue);
        setJobCurrent("capture", item.sourceTitle);

        try {
          let hostname = "";
          try {
            hostname = new URL(item.url).hostname;
          } catch {
            /* ignore */
          }
          if (hostname) {
            const last = domainLastAt.get(hostname) || 0;
            const gap = cfg.perDomainGapMs - (Date.now() - last);
            if (gap > 0) await wait(gap);
            domainLastAt.set(hostname, Date.now());
          }

          const out = await runSourceCapture(item);
          queue[idx] = {
            ...queue[idx],
            status: "done",
            folder: out.folder,
            finishedAt: new Date().toISOString(),
            error: undefined,
          };
          const sIdx = sources.findIndex((s) => s.id === item.sourceId);
          if (sIdx >= 0) {
            sources[sIdx] = {
              ...sources[sIdx],
              lastCaptureAt: queue[idx].finishedAt,
              lastCaptureFolder: out.folder,
              lastCaptureError: undefined,
              lastCaptureRoutes: out.routes.length ? out.routes : undefined,
            };
          }
          succeeded += 1;
          advanceJob("capture", { ok: true, current: item.sourceTitle });
          await appendAudit({
            action: "source_captured",
            detail: `${item.sourceTitle} → ${out.folder}`,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          queue[idx] = {
            ...queue[idx],
            status: "failed",
            error: message.slice(0, 400),
            finishedAt: new Date().toISOString(),
          };
          failed += 1;
          advanceJob("capture", { ok: false, current: item.sourceTitle });
          const sIdx = sources.findIndex((s) => s.id === item.sourceId);
          if (sIdx >= 0) {
            sources[sIdx] = {
              ...sources[sIdx],
              lastCaptureError: message.slice(0, 240),
            };
          }
          await appendAudit({
            action: "source_capture_failed",
            detail: `${item.sourceTitle}: ${message.slice(0, 240)}`,
          });
        }
        processed += 1;
      }

      await writeQueue(queue);
      await writeCollection("sources", sources);
      pendingLeft = countOpen(queue);

      if (pendingLeft > 0) {
        const job = getJobProgress("capture");
        ensureJob("capture", {
          total: job.total,
          label: `Capturing… ${job.done} done · ${pendingLeft} left`,
          current: "Next wave…",
        });
      } else {
        const job = getJobProgress("capture");
        endJob("capture", {
          label: `Capture complete · ${job.succeeded} saved · ${job.failed} failed`,
        });
        break;
      }
    } catch (err) {
      // Leave in-flight item as running so resume can recover it.
      endJob("capture", {
        error: true,
        label: err instanceof Error ? err.message : "Capture failed",
      });
      throw err;
    }
  }

  return {
    processed,
    failed,
    succeeded,
    pending: pendingLeft,
  };
}

/** Clear queue history, wipe artifact bundles, and reset source capture pointers. */
export async function clearAllCaptures(): Promise<{
  queueCleared: number;
  artifactsRemoved: number;
  artifactsFailed: number;
  sourcesReset: number;
  reason?: "capture_delete_partial" | "capture_delete_busy";
}> {
  await closeChromiumBrowser();

  const queue = await readCaptureQueue();
  const queueCleared = queue.length;
  await writeQueue([]);

  const { removed: artifactsRemoved, failed: artifactsFailed } =
    await clearAllArtifactBundles();

  const sources = await readCollection<Source>("sources", SEED_SOURCES);
  let sourcesReset = 0;
  const next = sources.map((s) => {
    if (
      !s.lastCaptureAt &&
      !s.lastCaptureFolder &&
      !s.lastCaptureError &&
      !s.lastCaptureRoutes?.length
    ) {
      return s;
    }
    sourcesReset += 1;
    return {
      ...s,
      lastCaptureAt: undefined,
      lastCaptureFolder: undefined,
      lastCaptureError: undefined,
      lastCaptureRoutes: undefined,
    };
  });
  await writeCollection("sources", next);

  const reason =
    artifactsFailed > 0
      ? artifactsRemoved === 0
        ? ("capture_delete_busy" as const)
        : ("capture_delete_partial" as const)
      : undefined;

  endJob("capture", {
    label: reason
      ? `Cleared with ${artifactsFailed} locked folder(s)`
      : "Capture data cleared",
    error: reason === "capture_delete_busy",
  });
  await appendAudit({
    action: "source_capture_cleared",
    detail: `Cleared ${queueCleared} queue item(s), removed ${artifactsRemoved} artifact folder(s), ${artifactsFailed} locked, reset ${sourcesReset} source(s)`,
  });

  return {
    queueCleared,
    artifactsRemoved,
    artifactsFailed,
    sourcesReset,
    reason,
  };
}

/** @deprecated use processCaptureQueue */
export const processCaptureQueueStub = processCaptureQueue;

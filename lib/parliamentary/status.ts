import { existsSync, readFileSync } from "fs";
import path from "path";
import { readHeartbeat, type QueueSnapshot } from "@/lib/parliamentary/heartbeat";
import {
  getSummary,
  readJobs,
  readPipeline,
  readProgress,
  readSeeds,
  type ParlProgressSnapshot,
} from "@/lib/parliamentary/store";
import { readSettings } from "@/lib/parliamentary/settings";
import { batchHardCap, parlDryRun } from "@/lib/parliamentary/config";
import { listParlLog } from "@/lib/parliamentary/log";
import { parseVimeoVideoId } from "@/lib/parliamentary/detect";
import { summarizeParlError } from "@/lib/parliamentary/errors";
import { previewPathForVimeo } from "@/lib/parliamentary/thumb";
import type { MediaJob, PipelineSummary } from "@/lib/parliamentary/types";

/** Heartbeat older than this ⇒ worker is offline for UI. */
export const WORKER_STALE_MS = 45_000;

export type EffectiveControl =
  | "idle"
  | "running"
  | "paused"
  | "cancelling"
  | "offline";

export type JobRowDto = ReturnType<typeof mapJobRow>;

export type AutomationDashboard = {
  summary: PipelineSummary & {
    effectiveControl: EffectiveControl;
    workerLive: boolean;
    workerAgeMs: number | null;
    workerPid: number | null;
  };
  heartbeat: QueueSnapshot | null;
  progress: ParlProgressSnapshot;
  jobs: {
    items: JobRowDto[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  seeds: Awaited<ReturnType<typeof readSeeds>>;
  settings: Awaited<ReturnType<typeof readSettings>>;
  hardCap: number;
  events: ReturnType<typeof listParlLog>;
  server: {
    dryRun: boolean;
    at: string;
    /** True when UI control differs from raw pipeline.control due to offline worker. */
    displayOverride: boolean;
    reason?: string;
  };
};

function workerPidAlive(pid: number | null | undefined): boolean {
  if (!pid || !Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPidFile(): number | null {
  try {
    const file = path.join(process.cwd(), "logs", "parl-media.pid");
    if (!existsSync(file)) return null;
    const n = Number(readFileSync(file, "utf8").trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function stageCount(jobs: MediaJob[], stage: MediaJob["stage"]) {
  return jobs.filter((j) => j.stage === stage).length;
}

export function mapJobRow(j: MediaJob) {
  const vimeoId =
    j.vimeoId ||
    (j.platform === "vimeo" ? parseVimeoVideoId(j.mediaUrl) : undefined) ||
    parseVimeoVideoId(j.mediaUrl);
  const legacyDump = !j.errorDetail && j.error && j.error.length > 160;
  const summary =
    j.error || j.errorDetail ? summarizeParlError(j.errorDetail || j.error) : null;
  return {
    id: j.id,
    title: j.title,
    country: j.country,
    platform: j.platform,
    stage: j.stage,
    progressPct: j.progressPct,
    progressPhase: j.progressPhase,
    progressLabel: j.progressLabel,
    bytesDownloaded: j.bytesDownloaded,
    bytesTotal: j.bytesTotal,
    bytesPerSec: j.bytesPerSec,
    retryCount: j.retryCount,
    asrProvider: j.asrProvider,
    model: j.model || null,
    transcriptStatus: j.transcriptStatus || null,
    hasTranscript:
      j.stage === "done" || j.transcriptStatus === "octivate_machine_transcript",
    updatedAt: j.updatedAt,
    error: legacyDump ? summary?.headline : j.error || summary?.headline,
    errorDetail: j.errorDetail || (legacyDump ? j.error : undefined),
    folder: j.folder || null,
    folderAbs: j.folder
      ? path.isAbsolute(j.folder)
        ? j.folder
        : path.resolve(process.cwd(), j.folder)
      : null,
    mediaUrl: j.mediaUrl,
    pageUrl: j.pageUrl,
    vimeoId: vimeoId || null,
    durationSec: j.durationSec,
    estimateAsrSec: j.estimateAsrSec,
    previewUrl: vimeoId ? previewPathForVimeo(vimeoId) : null,
  };
}

/**
 * Whether the parl-media worker process is alive (fresh heartbeat + live PID).
 * Used by control API so Start cannot look "running" with a dead worker.
 */
export async function getWorkerLiveness(): Promise<{
  live: boolean;
  ageMs: number | null;
  pid: number | null;
}> {
  const heartbeat = await readHeartbeat();
  const pidFile = readPidFile();
  const workerPid = heartbeat?.pid || pidFile;
  const ageMs = heartbeat?.at ? Date.now() - Date.parse(heartbeat.at) : null;
  const hbFresh =
    typeof ageMs === "number" &&
    Number.isFinite(ageMs) &&
    ageMs >= 0 &&
    ageMs < WORKER_STALE_MS;
  const live = Boolean(hbFresh && workerPidAlive(workerPid));
  return {
    live,
    ageMs: ageMs != null && Number.isFinite(ageMs) ? ageMs : null,
    pid: workerPid,
  };
}

/**
 * Single source of truth for Automation UI:
 * - never shows "running" unless the worker PID is alive and heartbeat is fresh
 * - queue/KPI counts always come from jobs.json when worker is offline
 * - does not mutate pipeline.control (restarted worker can resume)
 */
export async function loadAutomationDashboard(opts?: {
  page?: number;
  pageSize?: number;
  eventLimit?: number;
}): Promise<AutomationDashboard> {
  const page = Math.max(1, opts?.page || 1);
  const pageSize = Math.min(100, Math.max(1, opts?.pageSize || 10));
  const eventLimit = Math.min(250, Math.max(20, opts?.eventLimit || 80));

  const [pipeline, summary, jobs, heartbeat, progress, settings, seeds] =
    await Promise.all([
      readPipeline(),
      getSummary(),
      readJobs(),
      readHeartbeat(),
      readProgress(),
      readSettings(),
      readSeeds(),
    ]);

  const pidFile = readPidFile();
  const hbPid = heartbeat?.pid ?? null;
  const workerPid = hbPid || pidFile;
  const hbAgeMs = heartbeat?.at ? Date.now() - Date.parse(heartbeat.at) : null;
  const hbFresh =
    typeof hbAgeMs === "number" &&
    Number.isFinite(hbAgeMs) &&
    hbAgeMs >= 0 &&
    hbAgeMs < WORKER_STALE_MS;
  const pidAlive = workerPidAlive(workerPid);
  const workerLive = Boolean(hbFresh && pidAlive);

  const control = pipeline.control;
  const displayOverride = !workerLive && control !== "idle";
  const effectiveControl: EffectiveControl = displayOverride ? "offline" : control;

  const sorted = [...jobs].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  );
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const items = sorted.slice(start, start + pageSize).map(mapJobRow);

  const fromJobs = {
    held: stageCount(jobs, "held"),
    queued: stageCount(jobs, "queued"),
    downloading: stageCount(jobs, "downloading"),
    downloaded: stageCount(jobs, "downloaded"),
    transcribing: stageCount(jobs, "transcribing"),
    done: stageCount(jobs, "done"),
    failed: stageCount(jobs, "failed"),
    cancelled: stageCount(jobs, "cancelled"),
  };
  // Live heartbeat counts only while worker is alive — stale HB previously
  // zeroed the queue card even when jobs.json still had rows.
  const hbCounts = workerLive ? heartbeat?.counts : null;

  const mergedSummary: AutomationDashboard["summary"] = {
    ...summary,
    control,
    effectiveControl,
    workerLive,
    workerAgeMs: hbAgeMs != null && Number.isFinite(hbAgeMs) ? hbAgeMs : null,
    workerPid,
    found: hbCounts?.found ?? summary.found,
    held: hbCounts?.held ?? fromJobs.held,
    queued: hbCounts?.queued ?? fromJobs.queued,
    downloading: hbCounts?.downloading ?? fromJobs.downloading,
    downloaded: hbCounts?.downloaded ?? fromJobs.downloaded,
    transcribing: hbCounts?.transcribing ?? fromJobs.transcribing,
    done: hbCounts?.done ?? fromJobs.done,
    failed: hbCounts?.failed ?? fromJobs.failed,
    cancelled: hbCounts?.cancelled ?? fromJobs.cancelled,
    active:
      (hbCounts?.downloading ?? fromJobs.downloading) +
      (hbCounts?.downloaded ?? fromJobs.downloaded) +
      (hbCounts?.transcribing ?? fromJobs.transcribing),
    jobs: total,
  };

  return {
    summary: mergedSummary,
    heartbeat,
    progress,
    jobs: {
      items,
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
    seeds,
    settings,
    hardCap: batchHardCap(),
    events: listParlLog(eventLimit),
    server: {
      dryRun: parlDryRun(),
      at: new Date().toISOString(),
      displayOverride,
      reason: displayOverride
        ? !hbFresh
          ? `stale_heartbeat_${Math.round((hbAgeMs || 0) / 1000)}s`
          : "worker_pid_dead"
        : undefined,
    },
  };
}

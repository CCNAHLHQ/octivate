import { isRetryableAsrError, transcribeMediaJob } from "@/lib/parliamentary/asr";
import {
  asrConcurrency,
  dlConcurrency,
  parlDryRun,
} from "@/lib/parliamentary/config";
import { runCatalog } from "@/lib/parliamentary/catalog";
import {
  cleanupPartial,
  downloadMediaJob,
  isDownloadArtifactReady,
} from "@/lib/parliamentary/download";
import { estimateAsrSeconds } from "@/lib/parliamentary/estimate";
import { summarizeParlError } from "@/lib/parliamentary/errors";
import {
  buildQueueSnapshot,
  writeHeartbeat,
} from "@/lib/parliamentary/heartbeat";
import { parlLog } from "@/lib/parliamentary/log";
import { readSettings } from "@/lib/parliamentary/settings";
import {
  applyBatchQueue,
  patchJob,
  readCandidates,
  readJobs,
  readPipeline,
  setPipelineControl,
  writeProgress,
} from "@/lib/parliamentary/store";
import type { MediaJob } from "@/lib/parliamentary/types";
import { appendAudit } from "@/lib/protocol/audit";

const ACTIVE_STAGES = new Set([
  "queued",
  "downloading",
  "downloaded",
  "transcribing",
]);

/** In-flight workers keyed by job id — prevents double-claim. */
const inflight = new Set<string>();

/** Coalesced progress patches (max ~2/sec per job). */
const progressPending = new Map<string, Partial<MediaJob>>();
const progressTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleProgress(id: string, patch: Partial<MediaJob>) {
  const prev = progressPending.get(id) || {};
  progressPending.set(id, { ...prev, ...patch });
  if (progressTimers.has(id)) return;
  progressTimers.set(
    id,
    setTimeout(() => {
      progressTimers.delete(id);
      const pending = progressPending.get(id);
      progressPending.delete(id);
      if (pending) void patchJob(id, pending);
    }, 500)
  );
}

async function flushProgress(id: string) {
  const t = progressTimers.get(id);
  if (t) clearTimeout(t);
  progressTimers.delete(id);
  const pending = progressPending.get(id);
  progressPending.delete(id);
  if (pending) await patchJob(id, pending);
}

async function allowsWork() {
  const p = await readPipeline();
  return p.control === "running";
}

function hasUnfinishedWork(jobs: MediaJob[]) {
  return jobs.some((j) => ACTIVE_STAGES.has(j.stage));
}

let lastPulseKey = "";
let lastPulseLogAt = 0;

async function pulse(phase: string, message: string, current?: string) {
  const [pipeline, jobs, candidates] = await Promise.all([
    readPipeline(),
    readJobs(),
    readCandidates(),
  ]);
  const snap = buildQueueSnapshot({
    pipeline,
    jobs,
    found: candidates.length,
    phase,
    current,
    message,
    dryRun: parlDryRun(),
  });
  await writeHeartbeat(snap);
  await writeProgress({
    stage: phase,
    current,
    message,
    total:
      snap.counts.queued +
      snap.counts.downloading +
      snap.counts.downloaded +
      snap.counts.transcribing +
      snap.counts.done,
    done: snap.counts.done,
    failed: snap.counts.failed,
  });
  const key = `${phase}|${pipeline.control}|${message}|${current || ""}|${JSON.stringify(snap.counts)}`;
  const now = Date.now();
  if (key !== lastPulseKey || now - lastPulseLogAt > 30_000) {
    lastPulseKey = key;
    lastPulseLogAt = now;
    parlLog("debug", "heartbeat", {
      phase,
      control: snap.control,
      counts: snap.counts,
      current: current ?? null,
      queueHead: snap.queueHead.map((q) => `${q.stage}:${q.title.slice(0, 40)}`),
    });
  }
}

async function waitResume(): Promise<"continue" | "stop" | "abort"> {
  for (;;) {
    const p = await readPipeline();
    if (p.control === "cancelling") return "stop";
    if (p.control === "idle") return "abort";
    if (p.control === "running") return "continue";
    await pulse("paused", "Paused — queue held, waiting for resume");
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function stageAfterInterrupt(job: MediaJob): Promise<"downloaded" | "queued"> {
  if (await isDownloadArtifactReady(job.folder, job.videoPath)) return "downloaded";
  return "queued";
}

async function requeueInterrupted(job: MediaJob, reason: string) {
  const stage = await stageAfterInterrupt(job);
  parlLog("warn", "job requeued after interrupt", { id: job.id, stage, reason });
  await flushProgress(job.id);
  await patchJob(job.id, {
    stage,
    progressPct: stage === "downloaded" ? 50 : 0,
    progressPhase: "idle",
    progressLabel:
      stage === "downloaded" ? "Ready for ASR (resumed)" : "Queued (resumed)",
    error: undefined,
    errorDetail: undefined,
  });
}

async function cancelOpen() {
  parlLog("info", "cancel open jobs");
  for (const j of await readJobs()) {
    if (ACTIVE_STAGES.has(j.stage) || inflight.has(j.id)) {
      await flushProgress(j.id);
      await cleanupPartial(j.folder);
      await patchJob(j.id, {
        stage: "cancelled",
        finishedAt: new Date().toISOString(),
        error: "cancelled_by_operator",
        progressPhase: "idle",
      });
      inflight.delete(j.id);
      parlLog("warn", "job cancelled", { id: j.id, title: j.title });
    }
  }
}

/** Recover mid-flight rows — never promote to downloaded without artifact gate. */
export async function recoverInterruptedJobs() {
  let recovered = 0;
  for (const j of await readJobs()) {
    if (j.stage === "downloading") {
      await patchJob(j.id, {
        stage: "queued",
        progressPct: 0,
        progressPhase: "idle",
        progressLabel: "Queued after worker resume",
        bytesPerSec: 0,
      });
      recovered += 1;
    } else if (j.stage === "transcribing") {
      const stage = await stageAfterInterrupt(j);
      await patchJob(j.id, {
        stage,
        progressPct: stage === "downloaded" ? 50 : 0,
        progressPhase: "idle",
        progressLabel:
          stage === "downloaded"
            ? "Ready for ASR (resumed)"
            : "Queued after worker resume",
      });
      recovered += 1;
    } else if (j.stage === "downloaded") {
      // Demote optimistic downloaded rows that fail the gate.
      if (!(await isDownloadArtifactReady(j.folder, j.videoPath))) {
        await patchJob(j.id, {
          stage: "queued",
          progressPct: 0,
          progressPhase: "idle",
          progressLabel: "Re-queued — download incomplete",
        });
        recovered += 1;
      }
    }
  }
  if (recovered) parlLog("info", "recovered interrupted jobs", { recovered });
  return recovered;
}

async function failOrRetry(job: MediaJob, err: unknown) {
  await flushProgress(job.id);
  const msg = err instanceof Error ? err.message : String(err);
  const summary = summarizeParlError(msg);
  const settings = await readSettings();
  const retries = job.retryCount || 0;
  const retryable =
    isRetryableAsrError(msg) ||
    /download_incomplete|http_|ffmpeg_|vimeo_config_not_found|vimeo_stream_not_found|ECONN/i.test(
      msg
    );

  if (retryable && retries < settings.maxRetries) {
    const next = retries + 1;
    const backoffMs = Math.min(60_000, 2_000 * 2 ** retries);
    const stage = await stageAfterInterrupt(job);
    parlLog("warn", "job retry scheduled", {
      id: job.id,
      attempt: next,
      max: settings.maxRetries,
      backoffMs,
      stage,
      headline: summary.headline,
    });
    await patchJob(job.id, {
      stage,
      retryCount: next,
      progressPct: stage === "downloaded" ? 50 : 0,
      progressPhase: "retry",
      progressLabel: `Retry ${next}/${settings.maxRetries} in ${Math.round(backoffMs / 1000)}s`,
      error: summary.headline,
      errorDetail: summary.detail,
    });
    await new Promise((r) => setTimeout(r, backoffMs));
    return;
  }

  parlLog("error", "job failed", {
    id: job.id,
    title: job.title,
    code: summary.code,
    headline: summary.headline,
    retries,
  });
  await cleanupPartial(job.folder);
  await patchJob(job.id, {
    stage: "failed",
    error: summary.headline,
    errorDetail: summary.detail,
    finishedAt: new Date().toISOString(),
    progressPhase: "idle",
    progressLabel: "Failed",
  });
  await appendAudit({
    action: "automation_job_failed",
    detail: `${job.title} · ${summary.headline}`,
  }).catch(() => undefined);
}

async function downloadOne(job: MediaJob) {
  if (inflight.has(job.id)) return;
  inflight.add(job.id);
  try {
    parlLog("info", "download phase start", { id: job.id, title: job.title });
    const gate = await waitResume();
    if (gate === "stop") {
      await patchJob(job.id, {
        stage: "cancelled",
        finishedAt: new Date().toISOString(),
        error: "cancelled_by_operator",
      });
      return;
    }
    if (gate === "abort") {
      await requeueInterrupted(job, "control_idle");
      return;
    }
    try {
      await patchJob(job.id, {
        stage: "downloading",
        progressPct: 2,
        progressPhase: "download",
        progressLabel: "Starting download…",
        startedAt: job.startedAt || new Date().toISOString(),
        error: undefined,
        errorDetail: undefined,
      });
      await pulse("download", `Downloading · ${job.title}`, job.mediaUrl);
      let lastBytes = 0;
      let lastAt = Date.now();
      let peakBps = 0;
      const keepAlive = setInterval(() => {
        void pulse("download", `Downloading · ${job.title}`, job.mediaUrl);
      }, 15_000);
      try {
        const dl = await downloadMediaJob(job, {
          onProgress: (p) => {
            const now = Date.now();
            const dt = Math.max(0.2, (now - lastAt) / 1000);
            const delta = Math.max(0, p.bytesDownloaded - lastBytes);
            const bps = delta / dt;
            if (bps > peakBps) peakBps = bps;
            lastBytes = p.bytesDownloaded;
            lastAt = now;
            const mb = (n: number) => (n / 1e6).toFixed(n >= 100e6 ? 0 : 1);
            const mbps = (bps / 1e6).toFixed(2);
            scheduleProgress(job.id, {
              progressPct: Math.max(2, Math.min(48, Math.round(p.pct * 0.48))),
              progressPhase: "download",
              progressLabel: p.bytesTotal
                ? `${mb(p.bytesDownloaded)}/${mb(p.bytesTotal)} MB · ${mbps} MB/s`
                : `${mb(p.bytesDownloaded)} MB · ${mbps} MB/s`,
              bytesDownloaded: p.bytesDownloaded,
              bytesTotal: p.bytesTotal,
              bytesPerSec: Math.round(bps),
            });
          },
        });
        await flushProgress(job.id);
        // Gate already enforced inside downloadMediaJob; marker is on disk.
        if (!(await isDownloadArtifactReady(dl.folder, dl.videoPath))) {
          throw new Error("download_incomplete:post_gate_failed");
        }
        const eta = estimateAsrSeconds(dl.durationSec || job.durationSec);
        await patchJob(job.id, {
          folder: dl.folder,
          videoPath: dl.videoPath,
          durationSec: dl.durationSec || job.durationSec,
          progressPct: 50,
          stage: "downloaded",
          progressPhase: "idle",
          progressLabel: "Download complete — ready for ASR",
          estimateAsrSec: eta,
          bytesDownloaded: dl.bytes,
          bytesTotal: dl.bytes,
          bytesPerSec: 0,
          error: undefined,
          errorDetail: undefined,
        });
        if (peakBps > 0) {
          parlLog("info", "download peak throughput", {
            id: job.id,
            peakMBps: Number((peakBps / 1e6).toFixed(2)),
          });
        }
        parlLog("info", "download phase complete", {
          id: job.id,
          bytes: dl.bytes,
          readyForAsr: true,
        });
      } finally {
        clearInterval(keepAlive);
      }
    } catch (err) {
      await failOrRetry(job, err);
    }
  } finally {
    inflight.delete(job.id);
  }
}

async function transcribeOne(job: MediaJob) {
  if (inflight.has(job.id)) return;
  inflight.add(job.id);
  try {
    parlLog("info", "asr phase start", { id: job.id, title: job.title });
    const gate = await waitResume();
    if (gate === "stop") {
      await patchJob(job.id, {
        stage: "cancelled",
        finishedAt: new Date().toISOString(),
        error: "cancelled_by_operator",
      });
      return;
    }
    if (gate === "abort") {
      await requeueInterrupted(job, "control_idle");
      return;
    }
    if (!(await isDownloadArtifactReady(job.folder, job.videoPath))) {
      await failOrRetry(job, new Error("download_incomplete:missing_artifact_gate"));
      return;
    }
    try {
      await patchJob(job.id, {
        stage: "transcribing",
        progressPct: 52,
        progressPhase: "extract",
        progressLabel: "Preparing audio…",
        estimateAsrSec: estimateAsrSeconds(job.durationSec),
        error: undefined,
      });
      await pulse("transcribe", `Transcribing · ${job.title}`, job.title);
      const asr = await transcribeMediaJob(job, {
        onProgress: (pct, label, phase) => {
          scheduleProgress(job.id, {
            progressPct: Math.max(52, Math.min(99, 52 + Math.round(pct * 0.47))),
            progressPhase: phase || "asr",
            progressLabel: label,
          });
        },
      });
      await flushProgress(job.id);
      await patchJob(job.id, {
        stage: "done",
        progressPct: 100,
        progressPhase: "finalize",
        progressLabel: "Complete",
        durationSec: asr.durationSec,
        transcriptStatus: "octivate_machine_transcript",
        model: asr.model,
        asrProvider: asr.provider,
        audioPath: asr.audioPath,
        finishedAt: new Date().toISOString(),
        estimateAsrSec: 0,
      });
      try {
        const { upsertParlTranscriptSource } = await import("@/lib/evidence/index");
        const refreshed = await readJobs();
        const doneJob = refreshed.find((j) => j.id === job.id) || job;
        const upserted = await upsertParlTranscriptSource(doneJob);
        if (upserted) {
          parlLog("info", "parl source upserted", { id: job.id, sourceId: upserted.id });
          await appendAudit({
            action: "parl_source_upserted",
            detail: `${upserted.id} · ${upserted.title}`,
          });
        }
      } catch (err) {
        parlLog("warn", "parl source upsert failed", {
          id: job.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
      parlLog("info", "asr phase complete", {
        id: job.id,
        provider: asr.provider,
        model: asr.model,
        segments: asr.segmentCount,
      });
    } catch (err) {
      await failOrRetry(job, err);
    }
  } finally {
    inflight.delete(job.id);
  }
}

/**
 * Fill free download and ASR slots concurrently (per-job pipeline).
 * Backpressure: do not start new downloads when awaiting-ASR count >= batchSize.
 */
async function pumpWork() {
  const settings = await readSettings();
  const jobs = await readJobs();
  const dlSlots = dlConcurrency();
  const asrSlots = asrConcurrency();
  const awaitingAsr = jobs.filter((j) => j.stage === "downloaded").length;
  const backpressure = awaitingAsr >= settings.batchSize;

  const downloadingNow = [...inflight].filter((id) => {
    const j = jobs.find((x) => x.id === id);
    return j?.stage === "downloading" || j?.stage === "queued";
  }).length;
  // Count actual inflight by scanning stages mid-flight
  let dlInflight = 0;
  let asrInflight = 0;
  for (const id of inflight) {
    const j = jobs.find((x) => x.id === id);
    if (!j) {
      dlInflight += 1; // unknown — reserve
      continue;
    }
    if (j.stage === "downloading" || j.stage === "queued") dlInflight += 1;
    else if (j.stage === "transcribing" || j.stage === "downloaded") asrInflight += 1;
  }

  const started: Promise<void>[] = [];

  if (!backpressure) {
    const needDl = jobs.filter(
      (j) => j.stage === "queued" && !inflight.has(j.id)
    );
    const freeDl = Math.max(0, dlSlots - dlInflight);
    for (const j of needDl.slice(0, freeDl)) {
      started.push(downloadOne(j));
    }
  }

  const needAsr = jobs.filter(
    (j) => j.stage === "downloaded" && !inflight.has(j.id)
  );
  const freeAsr = Math.max(0, asrSlots - asrInflight);
  for (const j of needAsr.slice(0, freeAsr)) {
    started.push(transcribeOne(j));
  }

  void downloadingNow;
  if (started.length) {
    await Promise.race([
      Promise.allSettled(started),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
  }
}

export async function runPipelineLoop(opts?: { pollMs?: number }) {
  const pollMs = opts?.pollMs ?? 2000;
  let catalogued = false;
  parlLog("info", "pipeline loop ready", {
    pid: process.pid,
    dryRun: parlDryRun(),
    dlConcurrency: dlConcurrency(),
    asrConcurrency: asrConcurrency(),
    mode: "per_job_download_parallel_asr",
  });

  for (;;) {
    try {
      const pipeline = await readPipeline();

      if (pipeline.control === "cancelling") {
        await cancelOpen();
        await setPipelineControl("idle", { discoverDone: false });
        await pulse("idle", "Cancelled");
        catalogued = false;
        await new Promise((r) => setTimeout(r, pollMs));
        continue;
      }
      if (pipeline.control === "paused") {
        await pulse("paused", "Paused — queue preserved");
        await new Promise((r) => setTimeout(r, pollMs));
        continue;
      }
      if (pipeline.control !== "running") {
        const jobs = await readJobs();
        if (!hasUnfinishedWork(jobs) && inflight.size === 0) catalogued = false;
        await pulse("idle", "Idle — waiting for Start (queue preserved)");
        await new Promise((r) => setTimeout(r, pollMs));
        continue;
      }

      if (!catalogued) {
        const [jobs, candidates, settings] = await Promise.all([
          readJobs(),
          readCandidates(),
          readSettings(),
        ]);
        const unfinished = hasUnfinishedWork(jobs);

        if (unfinished && (pipeline.discoverDone || candidates.length > 0)) {
          parlLog("info", "pipeline resume existing queue", {
            unfinished: jobs.filter((j) => ACTIVE_STAGES.has(j.stage)).length,
            candidates: candidates.length,
          });
          await recoverInterruptedJobs();
          catalogued = true;
          await setPipelineControl("running", {
            discoverDone: true,
            lastError: undefined,
          });
          await pulse("resume", "Resuming queued work…");
        } else {
          parlLog("info", "pipeline catalog wave", {
            dryRun: parlDryRun(),
            batchSize: settings.batchSize,
          });
          await pulse("discover", `Cataloguing (batch cap ${settings.batchSize})…`);
          try {
            const result = await runCatalog({ shouldContinue: allowsWork });
            if (!(await allowsWork())) {
              parlLog("warn", "catalog interrupted — keeping prior queue");
              catalogued = unfinished;
              continue;
            }
            const applied = await applyBatchQueue(settings.batchSize);
            await recoverInterruptedJobs();
            catalogued = true;
            await setPipelineControl("running", {
              discoverDone: true,
              lastError: undefined,
            });
            parlLog("info", "batch queue applied", applied);
            await pulse(
              "discover",
              `Found ${result.candidates.length} · queued ${applied.queued} · held ${applied.held}`
            );
            if (result.dryRun || parlDryRun()) {
              parlLog("warn", "dry-run active - downloads skipped");
              await setPipelineControl("idle", { discoverDone: true });
              continue;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            parlLog("error", "catalog wave failed", { error: msg });
            if (unfinished) {
              catalogued = true;
              await setPipelineControl("running", { lastError: msg });
              await pulse("resume", `Catalog failed — resuming existing queue · ${msg}`);
            } else {
              await setPipelineControl("idle", { lastError: msg });
              await pulse("error", msg);
            }
            continue;
          }
        }
      }

      if (!(await allowsWork())) continue;

      await pumpWork();

      const jobs = await readJobs();
      const stuck = jobs.filter(
        (j) =>
          (j.stage === "transcribing" || j.stage === "downloading") &&
          !inflight.has(j.id)
      );
      if (stuck.length) {
        await recoverInterruptedJobs();
        continue;
      }

      const unfinished = hasUnfinishedWork(jobs) || inflight.size > 0;
      if (unfinished) {
        const active =
          jobs.filter((j) =>
            ["downloading", "downloaded", "transcribing", "queued"].includes(j.stage)
          ).length + inflight.size;
        await pulse("work", `Pipeline · ${active} active`, jobs.find((j) => inflight.has(j.id))?.title);
        await new Promise((r) => setTimeout(r, Math.min(pollMs, 800)));
        continue;
      }

      parlLog("info", "pipeline complete");
      await setPipelineControl("idle", { discoverDone: true });
      catalogued = false;
      await pulse("idle", "Pipeline complete — queue retained");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      parlLog("error", "pipeline loop iteration failed", { error: msg });
      await pulse("error", `Loop error · ${msg.slice(0, 160)}`);
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }
}

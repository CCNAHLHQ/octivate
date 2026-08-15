import { isRetryableAsrError, transcribeMediaJob } from "@/lib/parliamentary/asr";
import { asrConcurrency, parlDryRun } from "@/lib/parliamentary/config";
import { runCatalog } from "@/lib/parliamentary/catalog";
import { cleanupPartial, downloadMediaJob } from "@/lib/parliamentary/download";
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

/** Pause waits; cancelling stops; idle aborts work without marking cancelled. */
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

async function requeueInterrupted(job: MediaJob, reason: string) {
  const stage = job.folder && job.videoPath ? "downloaded" : "queued";
  parlLog("warn", "job requeued after interrupt", {
    id: job.id,
    stage,
    reason,
  });
  await patchJob(job.id, {
    stage,
    progressPct: stage === "downloaded" ? 50 : 0,
    progressPhase: "idle",
    progressLabel: stage === "downloaded" ? "Ready for ASR (resumed)" : "Queued (resumed)",
    error: undefined,
    errorDetail: undefined,
  });
}

async function cancelOpen() {
  parlLog("info", "cancel open jobs");
  for (const j of await readJobs()) {
    if (ACTIVE_STAGES.has(j.stage)) {
      await cleanupPartial(j.folder);
      await patchJob(j.id, {
        stage: "cancelled",
        finishedAt: new Date().toISOString(),
        error: "cancelled_by_operator",
        progressPhase: "idle",
      });
      parlLog("warn", "job cancelled", { id: j.id, title: j.title });
    }
  }
}

/** Recover jobs left mid-flight after worker restart. */
async function recoverInterruptedJobs() {
  const now = Date.now();
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
      if (j.folder && j.videoPath) {
        await patchJob(j.id, {
          stage: "downloaded",
          progressPct: 50,
          progressPhase: "idle",
          progressLabel: "Ready for ASR (resumed)",
        });
      } else {
        await patchJob(j.id, {
          stage: "queued",
          progressPct: 0,
          progressPhase: "idle",
          progressLabel: "Queued after worker resume",
        });
      }
      recovered += 1;
    } else if (j.stage === "queued" || j.stage === "downloaded") {
      // keep; optional stale label cleanup
      const age = now - Date.parse(j.updatedAt || j.createdAt);
      if (Number.isFinite(age) && age > 0 && j.progressPhase === "retry") {
        /* leave retry state */
      }
    }
  }
  if (recovered) {
    parlLog("info", "recovered interrupted jobs", { recovered });
  }
  return recovered;
}

async function failOrRetry(job: MediaJob, err: unknown) {
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
    parlLog("warn", "job retry scheduled", {
      id: job.id,
      attempt: next,
      max: settings.maxRetries,
      backoffMs,
      headline: summary.headline,
    });
    await patchJob(job.id, {
      stage: job.folder && job.videoPath ? "downloaded" : "queued",
      retryCount: next,
      progressPct: job.folder && job.videoPath ? 50 : 0,
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
    let lastPatch = 0;
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
          if (now - lastPatch < 400 && p.pct < 100) return;
          const dt = Math.max(0.2, (now - lastAt) / 1000);
          const delta = Math.max(0, p.bytesDownloaded - lastBytes);
          const bps = delta / dt;
          if (bps > peakBps) peakBps = bps;
          lastPatch = now;
          lastBytes = p.bytesDownloaded;
          lastAt = now;
          const mb = (n: number) => (n / 1e6).toFixed(n >= 100e6 ? 0 : 1);
          const mbps = (bps / 1e6).toFixed(2);
          void patchJob(job.id, {
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
}

async function transcribeOne(job: MediaJob) {
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
  if (!job.folder || !job.videoPath) {
    await failOrRetry(job, new Error("download_incomplete:missing_paths"));
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
    let lastPatch = 0;
    const asr = await transcribeMediaJob(job, {
      onProgress: (pct, label, phase) => {
        const now = Date.now();
        if (now - lastPatch < 400 && pct < 100) return;
        lastPatch = now;
        void patchJob(job.id, {
          progressPct: Math.max(52, Math.min(99, 52 + Math.round(pct * 0.47))),
          progressPhase: phase || "asr",
          progressLabel: label,
        });
      },
    });
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
}

async function runBatches(
  jobs: MediaJob[],
  label: string,
  worker: (j: MediaJob) => Promise<void>
) {
  const conc = asrConcurrency();
  parlLog("info", `${label} batch start`, { count: jobs.length, concurrency: conc });
  for (let i = 0; i < jobs.length; i += conc) {
    if (!(await allowsWork())) {
      parlLog("warn", `${label} paused/stopped — remaining stay queued`, {
        remaining: jobs.length - i,
      });
      break;
    }
    const batch = jobs.slice(i, i + conc);
    await Promise.all(batch.map((j) => worker(j)));
    await pulse(label, `${label} batch ${Math.floor(i / conc) + 1} finished`);
  }
}

export async function runPipelineLoop(opts?: { pollMs?: number }) {
  const pollMs = opts?.pollMs ?? 2000;
  let catalogued = false;
  parlLog("info", "pipeline loop ready", {
    pid: process.pid,
    dryRun: parlDryRun(),
    concurrency: asrConcurrency(),
    mode: "batch_download_then_asr_openrouter",
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
        // Keep catalogued latch if unfinished jobs remain so Start can resume cleanly.
        const jobs = await readJobs();
        if (!hasUnfinishedWork(jobs)) catalogued = false;
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
            // Do not idle-cancel existing queue on catalog failure if work remains.
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

      const needDownload = (await readJobs()).filter((j) => j.stage === "queued");
      if (needDownload.length) {
        await pulse("download", `Download phase · ${needDownload.length} job(s)`);
        await runBatches(needDownload, "download", downloadOne);
        continue;
      }

      const needAsr = (await readJobs()).filter((j) => j.stage === "downloaded");
      if (needAsr.length) {
        await pulse("transcribe", `ASR phase · ${needAsr.length} ready job(s)`);
        await runBatches(needAsr, "transcribe", transcribeOne);
        continue;
      }

      // Recover any stuck mid-flight rows before declaring complete.
      const stuck = (await readJobs()).filter(
        (j) => j.stage === "transcribing" || j.stage === "downloading"
      );
      if (stuck.length) {
        await recoverInterruptedJobs();
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

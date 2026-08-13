import { asrConcurrency, parlDryRun } from "@/lib/parliamentary/config";
import { runCatalog } from "@/lib/parliamentary/catalog";
import { cleanupPartial, downloadMediaJob } from "@/lib/parliamentary/download";
import { estimateAsrSeconds } from "@/lib/parliamentary/estimate";
import {
  buildQueueSnapshot,
  writeHeartbeat,
} from "@/lib/parliamentary/heartbeat";
import { parlLog } from "@/lib/parliamentary/log";
import {
  patchJob,
  readCandidates,
  readJobs,
  readPipeline,
  setPipelineControl,
  writeProgress,
} from "@/lib/parliamentary/store";
import { transcribeMediaJob } from "@/lib/parliamentary/asr";
import type { MediaJob } from "@/lib/parliamentary/types";
import { summarizeParlError } from "@/lib/parliamentary/errors";
import { appendAudit } from "@/lib/protocol/audit";

async function allowsWork() {
  const p = await readPipeline();
  return p.control === "running";
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

async function waitResume(): Promise<"continue" | "stop"> {
  for (;;) {
    const p = await readPipeline();
    if (p.control === "cancelling" || p.control === "idle") return "stop";
    if (p.control === "running") return "continue";
    await pulse("paused", "Paused - waiting for resume");
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function cancelOpen() {
  parlLog("info", "cancel open jobs");
  for (const j of await readJobs()) {
    if (["queued", "downloading", "downloaded", "transcribing"].includes(j.stage)) {
      await cleanupPartial(j.folder);
      await patchJob(j.id, {
        stage: "cancelled",
        finishedAt: new Date().toISOString(),
        error: "cancelled_by_operator",
      });
      parlLog("warn", "job cancelled", { id: j.id, title: j.title });
    }
  }
}

async function failJob(job: MediaJob, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const summary = summarizeParlError(msg);
  parlLog("error", "job failed", {
    id: job.id,
    title: job.title,
    mediaUrl: job.mediaUrl,
    code: summary.code,
    headline: summary.headline,
    error: summary.detail.slice(0, 500),
  });
  await cleanupPartial(job.folder);
  await patchJob(job.id, {
    stage: "failed",
    error: summary.headline,
    errorDetail: summary.detail,
    finishedAt: new Date().toISOString(),
  });
  await appendAudit({
    action: "automation_job_failed",
    detail: `${job.title} · ${summary.headline}`,
  }).catch(() => undefined);
}

/** Phase 1 — download only. Never starts ASR. */
async function downloadOne(job: MediaJob) {
  parlLog("info", "download phase start", {
    id: job.id,
    title: job.title,
    mediaUrl: job.mediaUrl,
  });
  if ((await waitResume()) === "stop") {
    await patchJob(job.id, {
      stage: "cancelled",
      finishedAt: new Date().toISOString(),
      error: "cancelled_by_operator",
    });
    return;
  }
  try {
    await patchJob(job.id, {
      stage: "downloading",
      progressPct: 10,
      startedAt: job.startedAt || new Date().toISOString(),
      error: undefined,
      errorDetail: undefined,
    });
    await pulse("download", `Downloading · ${job.title}`, job.mediaUrl);
    const dl = await downloadMediaJob(job);
    const eta = estimateAsrSeconds(dl.durationSec || job.durationSec);
    await patchJob(job.id, {
      folder: dl.folder,
      videoPath: dl.videoPath,
      durationSec: dl.durationSec || job.durationSec,
      progressPct: 50,
      stage: "downloaded",
      estimateAsrSec: eta,
      error: undefined,
      errorDetail: undefined,
    });
    parlLog("info", "download phase complete", {
      id: job.id,
      bytes: dl.bytes,
      durationSec: dl.durationSec ?? null,
      readyForAsr: true,
    });
    await pulse("download", `Downloaded · ${job.title}`, job.title);
  } catch (err) {
    await failJob(job, err);
  }
}

/** Phase 2 — ASR only after stage=downloaded + verified file. */
async function transcribeOne(job: MediaJob) {
  parlLog("info", "asr phase start", {
    id: job.id,
    title: job.title,
    videoPath: job.videoPath,
  });
  if ((await waitResume()) === "stop") {
    await patchJob(job.id, {
      stage: "cancelled",
      finishedAt: new Date().toISOString(),
      error: "cancelled_by_operator",
    });
    return;
  }
  if (!job.folder || !job.videoPath) {
    await failJob(job, new Error("download_incomplete:missing_paths"));
    return;
  }
  try {
    const eta = estimateAsrSeconds(job.durationSec);
    await patchJob(job.id, {
      stage: "transcribing",
      progressPct: 55,
      estimateAsrSec: eta,
      error: undefined,
    });
    await pulse(
      "transcribe",
      `Transcribing · ${job.title} (ETA ~${Math.round(eta / 60)}m)`,
      job.title
    );
    const asr = await transcribeMediaJob(job);
    await patchJob(job.id, {
      stage: "done",
      progressPct: 100,
      durationSec: asr.durationSec,
      transcriptStatus: "octivate_machine_transcript",
      model: asr.model,
      finishedAt: new Date().toISOString(),
      estimateAsrSec: 0,
    });
    parlLog("info", "asr phase complete", {
      id: job.id,
      title: job.title,
      durationSec: asr.durationSec ?? null,
      segments: asr.segmentCount,
      model: asr.model,
    });
  } catch (err) {
    await failJob(job, err);
  }
}

async function runBatches(
  jobs: MediaJob[],
  label: string,
  worker: (j: MediaJob) => Promise<void>
) {
  const conc = asrConcurrency();
  parlLog("info", `${label} batch start`, {
    count: jobs.length,
    concurrency: conc,
  });
  for (let i = 0; i < jobs.length; i += conc) {
    if (!(await allowsWork())) {
      parlLog("warn", `${label} interrupted`, { remaining: jobs.length - i });
      break;
    }
    const batch = jobs.slice(i, i + conc);
    parlLog("info", `${label} batch`, {
      index: i,
      size: batch.length,
      ids: batch.map((j) => j.id),
    });
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
    mode: "download_then_asr",
  });

  for (;;) {
    const pipeline = await readPipeline();

    if (pipeline.control === "cancelling") {
      parlLog("info", "pipeline cancelling");
      await cancelOpen();
      await setPipelineControl("idle", { discoverDone: false });
      await pulse("idle", "Cancelled");
      catalogued = false;
      await new Promise((r) => setTimeout(r, pollMs));
      continue;
    }
    if (pipeline.control === "paused") {
      await pulse("paused", "Paused");
      await new Promise((r) => setTimeout(r, pollMs));
      continue;
    }
    if (pipeline.control !== "running") {
      catalogued = false;
      await pulse("idle", "Idle - waiting for Start");
      await new Promise((r) => setTimeout(r, pollMs));
      continue;
    }

    if (!catalogued) {
      parlLog("info", "pipeline catalog wave", { dryRun: parlDryRun() });
      await pulse("discover", "Cataloguing verified sources...");
      try {
        const result = await runCatalog({ shouldContinue: allowsWork });
        catalogued = true;
        await setPipelineControl("running", { discoverDone: true, lastError: undefined });
        await pulse(
          "discover",
          `Catalogued ${result.candidates.length} media` +
            (result.dryRun ? " (dry-run - no download)" : "")
        );
        if (result.dryRun || parlDryRun()) {
          parlLog("warn", "dry-run active - downloads skipped", {
            tip: "Set PARL_MEDIA_DRY_RUN=0 in .env and restart parl:worker",
          });
          await setPipelineControl("idle", { discoverDone: true });
          continue;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        parlLog("error", "catalog wave failed", { error: msg });
        await setPipelineControl("idle", { lastError: msg });
        await pulse("error", msg);
        continue;
      }
    }

    if (!(await allowsWork())) continue;

    // Re-queue interrupted downloads from a prior crash.
    for (const j of await readJobs()) {
      if (j.stage === "downloading") {
        await patchJob(j.id, { stage: "queued", progressPct: 0 });
      }
    }

    const all = await readJobs();
    const needDownload = all.filter((j) => j.stage === "queued");
    if (needDownload.length) {
      await pulse("download", `Download phase · ${needDownload.length} job(s)`);
      await runBatches(needDownload, "download", downloadOne);
      continue; // re-evaluate control / pause before ASR
    }

    // Only jobs that finished download phase (stage=downloaded) may enter ASR.
    const needAsr = (await readJobs()).filter((j) => j.stage === "downloaded");
    if (needAsr.length) {
      await pulse("transcribe", `ASR phase · ${needAsr.length} fully downloaded job(s)`);
      await runBatches(needAsr, "transcribe", transcribeOne);
      continue;
    }

    const stuck = (await readJobs()).filter((j) => j.stage === "transcribing");
    if (stuck.length) {
      // Crash recovery: incomplete ASR → back to downloaded if files exist, else fail.
      for (const j of stuck) {
        if (j.folder && j.videoPath) {
          await patchJob(j.id, { stage: "downloaded", progressPct: 50 });
        } else {
          await failJob(j, new Error("download_incomplete:asr_interrupted_no_paths"));
        }
      }
      continue;
    }

    parlLog("info", "pipeline complete - no queued/downloaded work");
    await setPipelineControl("idle", { discoverDone: true });
    catalogued = false;
    await pulse("idle", "Pipeline complete");
  }
}

import { promises as fs } from "fs";
import path from "path";
import { pruneStaleTmpFiles } from "@/lib/parliamentary/atomic-json";
import { isDownloadArtifactReady } from "@/lib/parliamentary/download";
import { parlLog } from "@/lib/parliamentary/log";
import { mediaIndexDir } from "@/lib/parliamentary/paths";
import { readSettings } from "@/lib/parliamentary/settings";
import {
  admitHeldJobs,
  patchJob,
  readJobs,
  writeJobs,
} from "@/lib/parliamentary/store";
import type { MediaJob } from "@/lib/parliamentary/types";

const TRANSIENT_FAIL_RE =
  /ENOENT|EPERM|EACCES|EBUSY|EEXIST|rename|atomic|progress\.json|no such file|worker.?crash|loop error/i;

function folderAbs(folderRel?: string) {
  if (!folderRel) return null;
  return path.isAbsolute(folderRel)
    ? folderRel
    : path.join(process.cwd(), folderRel);
}

async function folderExists(folderRel?: string) {
  const abs = folderAbs(folderRel);
  if (!abs) return false;
  try {
    const st = await fs.stat(abs);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function stageAfterArtifact(job: MediaJob): Promise<"downloaded" | "queued"> {
  if (await isDownloadArtifactReady(job.folder, job.videoPath)) return "downloaded";
  return "queued";
}

export type ReconcileResult = {
  tmpPruned: number;
  recovered: number;
  missingFolderCleared: number;
  transientFailedRequeued: number;
  removedOrphans: number;
  admitted: number;
};

/**
 * Start/resume hygiene:
 * - drop stale writer .tmp sidecars
 * - requeue mid-flight rows (promote to downloaded only when gate passes)
 * - clear / requeue jobs whose on-disk folder vanished
 * - retry failed rows caused by transient FS/progress crashes
 * - admit held → queued up to batch size
 */
export async function reconcileAutomationQueue(): Promise<ReconcileResult> {
  const index = mediaIndexDir();
  await fs.mkdir(index, { recursive: true });
  const tmpPruned = await pruneStaleTmpFiles(index, { maxAgeMs: 15_000 });

  const jobs = await readJobs();
  const next: MediaJob[] = [];
  let recovered = 0;
  let missingFolderCleared = 0;
  let transientFailedRequeued = 0;
  let removedOrphans = 0;
  const now = new Date().toISOString();

  for (const j of jobs) {
    const hasFolder = await folderExists(j.folder);
    const errText = `${j.error || ""} ${j.errorDetail || ""}`;

    // Done rows with a vanished folder — drop the dead entry (artifact gone).
    if (j.stage === "done" && j.folder && !hasFolder) {
      removedOrphans += 1;
      parlLog("warn", "reconcile: removed done job with missing folder", {
        id: j.id,
        folder: j.folder,
      });
      continue;
    }

    // Failed due to progress/rename crash — give another chance.
    if (j.stage === "failed" && TRANSIENT_FAIL_RE.test(errText)) {
      const stage = await stageAfterArtifact(j);
      next.push({
        ...j,
        stage,
        progressPct: stage === "downloaded" ? 50 : 0,
        progressPhase: "idle",
        progressLabel:
          stage === "downloaded"
            ? "Ready for ASR (reconciled)"
            : "Re-queued after transient failure",
        error: undefined,
        errorDetail: undefined,
        finishedAt: undefined,
        updatedAt: now,
      });
      transientFailedRequeued += 1;
      continue;
    }

    // Mid-flight / completed download markers with missing folder → requeue clean.
    if (
      j.folder &&
      !hasFolder &&
      ["downloading", "downloaded", "transcribing", "queued"].includes(j.stage)
    ) {
      next.push({
        ...j,
        stage: "queued",
        folder: undefined,
        videoPath: undefined,
        progressPct: 0,
        progressPhase: "idle",
        progressLabel: "Re-queued — artifact folder missing",
        bytesDownloaded: undefined,
        bytesTotal: undefined,
        bytesPerSec: 0,
        error: undefined,
        errorDetail: undefined,
        updatedAt: now,
      });
      missingFolderCleared += 1;
      continue;
    }

    if (j.stage === "downloading" || j.stage === "transcribing") {
      const stage = await stageAfterArtifact(j);
      next.push({
        ...j,
        stage,
        progressPct: stage === "downloaded" ? 50 : 0,
        progressPhase: "idle",
        progressLabel:
          stage === "downloaded"
            ? "Ready for ASR (resumed)"
            : "Queued after worker resume",
        bytesPerSec: 0,
        error: undefined,
        errorDetail: undefined,
        updatedAt: now,
      });
      recovered += 1;
      continue;
    }

    if (j.stage === "downloaded") {
      if (!(await isDownloadArtifactReady(j.folder, j.videoPath))) {
        next.push({
          ...j,
          stage: "queued",
          progressPct: 0,
          progressPhase: "idle",
          progressLabel: "Re-queued — download incomplete",
          bytesPerSec: 0,
          updatedAt: now,
        });
        recovered += 1;
        continue;
      }
    }

    next.push(j);
  }

  if (
    recovered ||
    missingFolderCleared ||
    transientFailedRequeued ||
    removedOrphans ||
    next.length !== jobs.length
  ) {
    await writeJobs(next);
  }

  const settings = await readSettings();
  const admitted = await admitHeldJobs(settings.batchSize);

  const result: ReconcileResult = {
    tmpPruned,
    recovered,
    missingFolderCleared,
    transientFailedRequeued,
    removedOrphans,
    admitted: admitted.admitted,
  };
  if (
    result.tmpPruned ||
    result.recovered ||
    result.missingFolderCleared ||
    result.transientFailedRequeued ||
    result.removedOrphans ||
    result.admitted
  ) {
    parlLog("info", "reconcile automation queue", result);
  }
  return result;
}

/** Worker-side recovery used by the pipeline loop (keeps prior export semantics). */
export async function recoverInterruptedJobs() {
  const r = await reconcileAutomationQueue();
  return r.recovered + r.missingFolderCleared + r.transientFailedRequeued;
}

/** Patch helper kept for call sites that still recover a single row. */
export async function requeueJobAfterInterrupt(job: MediaJob, reason: string) {
  const stage = await stageAfterArtifact(job);
  parlLog("warn", "job requeued after interrupt", { id: job.id, stage, reason });
  await patchJob(job.id, {
    stage,
    progressPct: stage === "downloaded" ? 50 : 0,
    progressPhase: "idle",
    progressLabel:
      stage === "downloaded" ? "Ready for ASR (resumed)" : "Queued (resumed)",
    error: undefined,
    errorDetail: undefined,
    bytesPerSec: 0,
  });
}

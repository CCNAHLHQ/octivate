import { spawn } from "child_process";
import path from "path";
import {
  defaultSteps,
  idleFcJob,
  readFcJob,
  writeFcJob,
} from "@/lib/future-caribbean/job-store";
import {
  FC_PUBLISH_TARGET,
  FC_PUBLISH_TARGET_LABEL,
  fcCredentials,
} from "@/lib/future-caribbean/config";
import type { FcSyncMode } from "@/lib/future-caribbean/types";

export type StartFcSyncOptions = {
  mode?: FcSyncMode;
  auto?: boolean;
};

function modeLabel(mode: FcSyncMode) {
  if (mode === "recent") return "yesterday & today";
  if (mode === "all") return "all planned days";
  return "missing days";
}

export async function startFcLogbookSync(
  opts: StartFcSyncOptions = {}
): Promise<{
  started: boolean;
  job: Awaited<ReturnType<typeof readFcJob>>;
  error?: string;
}> {
  const mode: FcSyncMode = opts.mode || "missing";
  const auto = Boolean(opts.auto);
  const current = await readFcJob();
  if (current.status === "running") {
    return { started: false, job: current, error: "sync_already_running" };
  }

  const creds = fcCredentials();
  if (!creds.email || !creds.password) {
    return {
      started: false,
      job: current,
      error: "fc_credentials_missing",
    };
  }

  const job = idleFcJob();
  job.id = `fc_${Date.now().toString(36)}`;
  job.status = "running";
  job.mode = mode;
  job.auto = auto;
  job.startedAt = new Date().toISOString();
  job.finishedAt = null;
  job.steps = defaultSteps();
  if (mode === "recent") {
    job.steps = job.steps.map((s) =>
      s.id === "publish"
        ? { ...s, label: "Auto-upload yesterday & today to Future Caribbean" }
        : s
    );
  }
  job.publishTarget = FC_PUBLISH_TARGET;
  job.publishTargetLabel = FC_PUBLISH_TARGET_LABEL;
  job.progress = {
    done: 0,
    total: job.steps.length,
    pct: 2,
    label: `${auto ? "Auto-" : ""}Publishing ${modeLabel(mode)} → ${FC_PUBLISH_TARGET_LABEL}`,
  };
  await writeFcJob(job);

  const script = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "scripts",
    "fc-logbook-sync.mjs"
  );
  const child = spawn(process.execPath, [script], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      FC_LOGBOOK_EMAIL: creds.email,
      FC_LOGBOOK_PASSWORD: creds.password,
      FC_SYNC_MODE: mode,
      FC_SYNC_AUTO: auto ? "1" : "0",
    },
    windowsHide: true,
  });
  child.unref();

  return { started: true, job };
}

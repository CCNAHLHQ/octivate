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

export async function startFcLogbookSync(): Promise<{
  started: boolean;
  job: Awaited<ReturnType<typeof readFcJob>>;
  error?: string;
}> {
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
  job.startedAt = new Date().toISOString();
  job.finishedAt = null;
  job.steps = defaultSteps();
  job.publishTarget = FC_PUBLISH_TARGET;
  job.publishTargetLabel = FC_PUBLISH_TARGET_LABEL;
  job.progress = {
    done: 0,
    total: job.steps.length,
    pct: 2,
    label: `Starting publisher → ${FC_PUBLISH_TARGET_LABEL}`,
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
    },
    windowsHide: true,
  });
  child.unref();

  return { started: true, job };
}

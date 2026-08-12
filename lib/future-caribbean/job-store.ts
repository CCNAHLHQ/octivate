import fs from "fs/promises";
import path from "path";
import type { FcLogbookJob, FcJobStep } from "@/lib/future-caribbean/types";
import {
  FC_PUBLISH_TARGET,
  FC_PUBLISH_TARGET_LABEL,
} from "@/lib/future-caribbean/config";

const JOB_PATH = () =>
  path.join(/* turbopackIgnore: true */ process.cwd(), "data", "local", "fc-logbook-job.json");

export function idleFcJob(): FcLogbookJob {
  return {
    id: "idle",
    status: "idle",
    mode: "missing",
    auto: false,
    publishTarget: FC_PUBLISH_TARGET,
    publishTargetLabel: FC_PUBLISH_TARGET_LABEL,
    startedAt: null,
    finishedAt: null,
    steps: defaultSteps().map((s) => ({ ...s, status: "pending" })),
    progress: { done: 0, total: 4, pct: 0, label: "Ready" },
  };
}

export function defaultSteps(): FcJobStep[] {
  return [
    {
      id: "prepare",
      label: "Load planned Octivate journey entries",
      status: "pending",
    },
    {
      id: "github",
      label: "Upload evidence screenshots to GitHub",
      status: "pending",
    },
    {
      id: "check",
      label: "Check Future Caribbean logbook vs planned days",
      status: "pending",
    },
    {
      id: "publish",
      label: "Publish selected entries to Future Caribbean",
      status: "pending",
    },
  ];
}

export async function readFcJob(): Promise<FcLogbookJob> {
  try {
    const raw = await fs.readFile(JOB_PATH(), "utf8");
    return JSON.parse(raw) as FcLogbookJob;
  } catch {
    return idleFcJob();
  }
}

export async function writeFcJob(job: FcLogbookJob): Promise<void> {
  await fs.mkdir(path.dirname(JOB_PATH()), { recursive: true });
  await fs.writeFile(JOB_PATH(), JSON.stringify(job, null, 2), "utf8");
}

export function markStep(
  job: FcLogbookJob,
  stepId: string,
  status: FcJobStep["status"],
  detail?: string
) {
  job.steps = job.steps.map((s) =>
    s.id === stepId ? { ...s, status, detail: detail ?? s.detail } : s
  );
  const done = job.steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  const running = job.steps.find((s) => s.status === "running");
  job.progress = {
    done,
    total: job.steps.length,
    pct: Math.round((done / Math.max(1, job.steps.length)) * 100),
    label: running?.label || (job.status === "done" ? "Complete" : "Working…"),
  };
}

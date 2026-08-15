import { promises as fs } from "fs";
import path from "path";
import { atomicWriteJson } from "@/lib/parliamentary/atomic-json";
import { mediaIndexDir } from "@/lib/parliamentary/paths";
import { formatEta } from "@/lib/parliamentary/estimate";
import type { MediaJob, PipelineState } from "@/lib/parliamentary/types";

export type QueueSnapshot = {
  at: string;
  pid: number;
  control: PipelineState["control"];
  phase: string;
  current?: string;
  message: string;
  counts: {
    found: number;
    held: number;
    queued: number;
    downloading: number;
    downloaded: number;
    transcribing: number;
    done: number;
    failed: number;
    cancelled: number;
  };
  queueHead: {
    id: string;
    title: string;
    stage: string;
    country: string;
    progressPct: number;
    estimateAsrSec?: number;
    eta?: string;
    error?: string;
  }[];
  dryRun: boolean;
};

export async function writeHeartbeat(snap: QueueSnapshot) {
  const dir = mediaIndexDir();
  await atomicWriteJson(path.join(dir, "heartbeat.json"), snap);
}

export async function readHeartbeat(): Promise<QueueSnapshot | null> {
  try {
    const raw = await fs.readFile(path.join(mediaIndexDir(), "heartbeat.json"), "utf8");
    return JSON.parse(raw) as QueueSnapshot;
  } catch {
    return null;
  }
}

export function buildQueueSnapshot(opts: {
  pipeline: PipelineState;
  jobs: MediaJob[];
  found: number;
  phase: string;
  current?: string;
  message: string;
  dryRun: boolean;
}): QueueSnapshot {
  const count = (stage: MediaJob["stage"]) =>
    opts.jobs.filter((j) => j.stage === stage).length;
  const active = opts.jobs.filter((j) =>
    ["queued", "downloading", "downloaded", "transcribing"].includes(j.stage)
  );
  return {
    at: new Date().toISOString(),
    pid: process.pid,
    control: opts.pipeline.control,
    phase: opts.phase,
    current: opts.current,
    message: opts.message,
    counts: {
      found: opts.found,
      held: count("held"),
      queued: count("queued"),
      downloading: count("downloading"),
      downloaded: count("downloaded"),
      transcribing: count("transcribing"),
      done: count("done"),
      failed: count("failed"),
      cancelled: count("cancelled"),
    },
    queueHead: active.slice(0, 12).map((j) => ({
      id: j.id,
      title: j.title,
      stage: j.stage,
      country: j.country,
      progressPct: j.progressPct,
      estimateAsrSec: j.estimateAsrSec,
      eta: j.estimateAsrSec ? formatEta(j.estimateAsrSec) : undefined,
      error: j.error,
    })),
    dryRun: opts.dryRun,
  };
}

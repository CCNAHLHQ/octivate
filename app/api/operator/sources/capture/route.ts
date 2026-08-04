import { NextRequest } from "next/server";
import { z } from "zod";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { artifactsRootLabel } from "@/lib/sources/artifacts";
import {
  clearAllCaptures,
  enqueueSourceCaptures,
  readCaptureQueue,
} from "@/lib/sources/capture";
import {
  CAPTURE_RUNNER_READY,
  isCaptureRunnerAvailable,
} from "@/lib/sources/capture-runner";
import { readProbeConfig } from "@/lib/sources/probe-config";

const postSchema = z.object({
  mode: z.enum(["stale", "all", "one", "drain", "resume"]).default("stale"),
  sourceId: z.string().min(1).optional(),
});

/** Never return absolute filesystem paths or Node errno text to the client. */
function publicCaptureError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (
    lower.includes("ebusy") ||
    lower.includes("eperm") ||
    lower.includes("eacces") ||
    lower.includes("locked") ||
    lower.includes("resource busy")
  ) {
    return "capture_delete_busy";
  }
  if (
    /[a-z]:\\/i.test(raw) ||
    raw.includes(process.cwd()) ||
    lower.includes("source-artifacts") ||
    lower.includes("enoent") ||
    lower.includes("errno")
  ) {
    return "capture_delete_failed";
  }
  return raw.slice(0, 160) || "capture_delete_failed";
}

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const config = await readProbeConfig();
  const queue = await readCaptureQueue();
  const pending = queue.filter((q) => q.status === "pending").length;
  const running = queue.filter((q) => q.status === "running").length;
  return jsonOk({
    config: {
      captureEnabled: config.captureEnabled,
      captureMaxVersions: config.captureMaxVersions,
      captureMaxHtmlBytes: config.captureMaxHtmlBytes,
    },
    runnerReady: isCaptureRunnerAvailable(),
    runnerImplemented: CAPTURE_RUNNER_READY,
    artifactsRoot: artifactsRootLabel(),
    queue: queue.slice(0, 40),
    pending: pending + running,
    pendingOnly: pending,
    running,
    done: queue.filter((q) => q.status === "done").length,
    failed: queue.filter((q) => q.status === "failed").length,
  });
}

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = postSchema.safeParse(body ?? {});
  if (!parsed.success) return jsonError(parsed.error.message);
  if (parsed.data.mode === "one" && !parsed.data.sourceId) {
    return jsonError("sourceId required for mode=one");
  }

  try {
    const result = await enqueueSourceCaptures({
      mode: parsed.data.mode,
      sourceId: parsed.data.sourceId,
    });
    return jsonOk({
      ...result,
      runnerReady: isCaptureRunnerAvailable(),
      artifactsRoot: artifactsRootLabel(),
    });
  } catch (err) {
    return jsonError(publicCaptureError(err), 400);
  }
}

export async function DELETE(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  try {
    const result = await clearAllCaptures();
    return jsonOk({ ok: true, ...result });
  } catch (err) {
    return jsonError(publicCaptureError(err), 400);
  }
}

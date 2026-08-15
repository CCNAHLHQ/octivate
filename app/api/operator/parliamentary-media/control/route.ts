import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { requireOperatorUser, resolveRequestUser } from "@/lib/auth/scope";
import { appendAudit } from "@/lib/protocol/audit";
import { clearAutomationWorkspace } from "@/lib/parliamentary/clear";
import { parlEnabled } from "@/lib/parliamentary/config";
import { readPipeline, setPipelineControl } from "@/lib/parliamentary/store";
import { parlLog } from "@/lib/parliamentary/log";
import { getWorkerLiveness } from "@/lib/parliamentary/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "start" | "pause" | "cancel" | "clear";

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  if (!parlEnabled()) {
    return jsonError("Automation media ingest is disabled", 503);
  }

  let body: { action?: string; confirm?: boolean };
  try {
    body = (await req.json()) as { action?: string; confirm?: boolean };
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const action = String(body.action || "") as Action;
  if (
    action !== "start" &&
    action !== "pause" &&
    action !== "cancel" &&
    action !== "clear"
  ) {
    return jsonError("action must be start | pause | cancel | clear", 400);
  }

  const who = gate.user.email || gate.user.id;
  const cur = await readPipeline();

  if (action === "clear") {
    if (body.confirm !== true) {
      return jsonError("clear requires confirm: true", 400);
    }
    const result = await clearAutomationWorkspace();
    parlLog("warn", "operator clear", {
      by: who,
      killedPid: result.killedPid,
      workerPid: result.workerPid,
    });
    await appendAudit({
      action: "automation_pipeline_clear",
      detail: `Automation hard-cleared by ${who} (killed=${result.killedPid ?? "none"}, worker=${result.workerPid ?? "none"})`,
    });
    return jsonOk({ action, ...result });
  }

  if (action === "start") {
    const worker = await getWorkerLiveness();
    if (!worker.live) {
      // Do not leave control=running with a dead worker — UI would lie again.
      await setPipelineControl("idle", {
        discoverDone: cur.discoverDone,
        lastError: "worker_offline",
      });
      return jsonError(
        "Media worker is offline. Restart the parl-media worker, then press Start.",
        503
      );
    }
    const { readJobs } = await import("@/lib/parliamentary/store");
    const jobs = await readJobs();
    const unfinished = jobs.some((j) =>
      ["queued", "downloading", "downloaded", "transcribing"].includes(j.stage)
    );
    const next = await setPipelineControl("running", {
      // Resume existing queue without forcing a fresh catalog wipe.
      discoverDone: unfinished ? true : false,
      lastError: undefined,
    });
    parlLog("info", "operator start", { by: who, resume: unfinished, workerPid: worker.pid });
    await appendAudit({
      action: "automation_pipeline_start",
      detail: unfinished
        ? `Automation pipeline resumed by ${who}`
        : `Automation pipeline started by ${who}`,
    });
    return jsonOk({ pipeline: next, action, resume: unfinished });
  }
  if (action === "pause") {
    if (cur.control !== "running" && cur.control !== "paused") {
      return jsonError("Pipeline is not running", 409);
    }
    const next = await setPipelineControl("paused");
    parlLog("info", "operator pause", { by: who });
    await appendAudit({
      action: "automation_pipeline_pause",
      detail: `Automation pipeline paused by ${who}`,
    });
    return jsonOk({ pipeline: next, action });
  }

  // Cancel with a dead worker must force idle — nothing will process "cancelling".
  const worker = await getWorkerLiveness();
  if (!worker.live) {
    const next = await setPipelineControl("idle", {
      discoverDone: cur.discoverDone,
      lastError: undefined,
    });
    parlLog("info", "operator cancel (worker offline → idle)", { by: who });
    await appendAudit({
      action: "automation_pipeline_cancel",
      detail: `Automation pipeline forced idle by ${who} (worker offline)`,
    });
    return jsonOk({ pipeline: next, action, forcedIdle: true });
  }

  const next = await setPipelineControl("cancelling");
  parlLog("info", "operator cancel", { by: who });
  await appendAudit({
    action: "automation_pipeline_cancel",
    detail: `Automation pipeline cancel requested by ${who}`,
  });
  return jsonOk({ pipeline: next, action });
}

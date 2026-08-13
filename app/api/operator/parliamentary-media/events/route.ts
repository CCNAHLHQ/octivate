import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { requireOperatorUser, resolveRequestUser } from "@/lib/auth/scope";
import { readHeartbeat } from "@/lib/parliamentary/heartbeat";
import { listParlLog } from "@/lib/parliamentary/log";
import { getSummary, readJobs, readProgress } from "@/lib/parliamentary/store";
import { parlDryRun } from "@/lib/parliamentary/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live automation debug feed: disk JSONL events + heartbeat + queue snapshot. */
export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  const limit = Math.min(
    250,
    Math.max(20, Number(req.nextUrl.searchParams.get("limit") || 120) || 120)
  );

  const [events, summary, progress, heartbeat, jobs] = await Promise.all([
    Promise.resolve(listParlLog(limit)),
    getSummary(),
    readProgress(),
    readHeartbeat(),
    readJobs(),
  ]);

  const queue = jobs
    .filter((j) =>
      ["queued", "downloading", "downloaded", "transcribing", "failed"].includes(j.stage)
    )
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 20)
    .map((j) => ({
      id: j.id,
      title: j.title,
      stage: j.stage,
      country: j.country,
      progressPct: j.progressPct,
      estimateAsrSec: j.estimateAsrSec,
      error: j.error,
      updatedAt: j.updatedAt,
      mediaUrl: j.mediaUrl,
    }));

  return jsonOk({
    events,
    summary,
    progress,
    heartbeat,
    queue,
    server: {
      dryRun: parlDryRun(),
      at: new Date().toISOString(),
      eventCount: events.length,
      workerPid: heartbeat?.pid ?? null,
      workerAgeMs: heartbeat ? Date.now() - Date.parse(heartbeat.at) : null,
    },
  });
}

import type { AgentSession } from "@/lib/types";
import { flushSessionUsage } from "@/lib/usage/usage-store";
import { emitSession, getSession, listSessions, persistSession } from "./session-store";
import { isStaleRunning } from "./session-stale";
import { recordWorkspaceFailure } from "@/lib/protocol/pipeline-failure";

export { isStaleRunning, STALE_INACTIVITY_MS, sessionLastActivityMs } from "./session-stale";

export const SUPERSEDED_CODE = "superseded";
export const STALE_TIMEOUT_CODE = "stale_timeout";

export function isSuperseded(session: AgentSession): boolean {
  return session.errorDetail?.code === SUPERSEDED_CODE;
}

async function markTerminal(
  session: AgentSession,
  opts: {
    code: string;
    message: string;
    /** When true, flush spend here (stale recovery). Supersede leaves flush to the pipeline catch. */
    flushUsage?: boolean;
    usageLabel?: string;
  }
): Promise<AgentSession> {
  const live = (await getSession(session.id)) || session;
  if (live.status !== "running") return live;

  live.status = "failed";
  live.error = opts.message;
  live.errorDetail = {
    code: opts.code,
    model: live.modelUsed,
    stage: live.stages.find((s) => s.status === "running")?.name,
    at: new Date().toISOString(),
  };
  live.completedAt = new Date().toISOString();
  live.updatedAt = live.completedAt;

  for (const stage of live.stages) {
    if (stage.status === "running") {
      stage.status = "failed";
      stage.message = opts.message;
    }
  }

  if (opts.flushUsage && opts.usageLabel) {
    await flushSessionUsage(live, opts.usageLabel);
  }
  await persistSession(live);
  emitSession(live);

  const action =
    opts.code === SUPERSEDED_CODE
      ? "pipeline_superseded"
      : opts.code === STALE_TIMEOUT_CODE
        ? "pipeline_stale_timeout"
        : "pipeline_failed";

  await recordWorkspaceFailure({
    action,
    message: opts.message,
    session: live,
    stage: live.errorDetail?.stage,
    level: opts.code === SUPERSEDED_CODE ? "info" : "error",
    extra: { code: opts.code },
  }).catch(() => undefined);

  return live;
}

/** Fail abandoned running sessions so concurrent slots and UI unlock. */
export async function recoverStaleSessions(): Promise<number> {
  const all = await listSessions();
  let n = 0;
  for (const s of all) {
    if (!isStaleRunning(s)) continue;
    await markTerminal(s, {
      code: STALE_TIMEOUT_CODE,
      message:
        "Workflow timed out with no progress — the previous run was marked failed so you can rerun.",
      flushUsage: true,
      usageLabel: "Doctrine agent pipeline (stale timeout)",
    });
    n += 1;
  }
  return n;
}

/** Stop in-flight runs on a project so a new start/rerun can take over. */
export async function supersedeProjectRunningSessions(
  projectId: string,
  exceptSessionId?: string
): Promise<number> {
  const all = await listSessions();
  const targets = all.filter(
    (s) =>
      s.projectId === projectId &&
      s.status === "running" &&
      s.id !== exceptSessionId
  );
  for (const s of targets) {
    await markTerminal(s, {
      code: SUPERSEDED_CODE,
      message: "Superseded by a new workflow run on this project.",
    });
  }
  return targets.length;
}

export async function countRunningSessions(): Promise<number> {
  const all = await listSessions();
  return all.filter((s) => s.status === "running").length;
}

export async function findProjectRunningSession(
  projectId: string
): Promise<AgentSession | null> {
  const all = await listSessions();
  return all.find((s) => s.projectId === projectId && s.status === "running") ?? null;
}

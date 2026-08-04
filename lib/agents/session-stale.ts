import type { AgentSession, AnalysisDepth } from "@/lib/types";

/** Wall-clock ceilings by depth — past this, a "running" session is treated as abandoned. */
const MAX_AGE_MS: Record<AnalysisDepth, number> = {
  rapid: 20 * 60 * 1000,
  standard: 60 * 60 * 1000,
  deep_dive: 120 * 60 * 1000,
};

/** No stage progress for this long ⇒ abandoned (covers crashed workers mid-call). */
export const STALE_INACTIVITY_MS = 25 * 60 * 1000;

export function sessionLastActivityMs(session: AgentSession): number {
  const stamps = [
    session.updatedAt,
    session.startedAt,
    session.completedAt,
    ...session.stages.flatMap((s) => [s.startedAt, s.completedAt]),
  ].filter((t): t is string => typeof t === "string" && t.length > 0);
  if (!stamps.length) return 0;
  return Math.max(...stamps.map((t) => Date.parse(t) || 0));
}

/** Pure check — safe for client components. */
export function isStaleRunning(session: AgentSession, now = Date.now()): boolean {
  if (session.status !== "running") return false;
  const depth = session.analysisDepth || "standard";
  const maxAge = MAX_AGE_MS[depth] ?? MAX_AGE_MS.standard;
  const started = Date.parse(session.startedAt) || 0;
  if (started && now - started > maxAge) return true;
  const last = sessionLastActivityMs(session);
  if (last && now - last > STALE_INACTIVITY_MS) return true;
  return false;
}

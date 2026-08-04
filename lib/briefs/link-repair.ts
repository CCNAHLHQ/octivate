import { readCollection, writeCollection, uid } from "@/lib/store/json-store";
import { SEED_BRIEFS, SEED_PROJECTS } from "@/lib/mock/seed";
import { normalizeBrief, normalizeBriefs } from "@/lib/briefs/normalize";
import type { AgentSession, Brief, Project } from "@/lib/types";
import { listSessions, persistSession } from "@/lib/agents/session-store";

export type BriefLinkRepairReport = {
  briefSessionBackfill: number;
  sessionBriefBackfill: number;
  syntheticSessions: number;
  staleSessionBriefCleared: number;
  shapeNormalized: number;
  briefs: Brief[];
  sessions: AgentSession[];
};

/**
 * Repair bidirectional brief ↔ session links, clear dangling session.briefId,
 * normalize gap/list shapes, and attach orphan seed briefs to sessions.
 */
export async function repairBriefLinks(persist = true): Promise<BriefLinkRepairReport> {
  const [rawBriefs, sessions, projects] = await Promise.all([
    readCollection<Brief>("briefs", SEED_BRIEFS),
    listSessions(),
    readCollection<Project>("projects", SEED_PROJECTS),
  ]);

  let shapeNormalized = 0;
  const briefs = rawBriefs.map((b) => {
    const next = normalizeBrief(b);
    if (JSON.stringify(next) !== JSON.stringify(b)) shapeNormalized += 1;
    return next;
  });

  const briefIds = new Set(briefs.map((b) => b.id));
  const projectIds = new Set(projects.map((p) => p.id));
  let briefSessionBackfill = 0;
  let sessionBriefBackfill = 0;
  let syntheticSessions = 0;
  let staleSessionBriefCleared = 0;

  // 0) Clear dangling session.briefId → ghost View result links
  for (const sess of sessions) {
    if (sess.briefId && !briefIds.has(sess.briefId)) {
      delete sess.briefId;
      staleSessionBriefCleared += 1;
    }
  }

  // 1) brief.sessionId ← session.briefId
  for (const brief of briefs) {
    if (brief.sessionId) continue;
    const byBrief = sessions.find((s) => s.briefId === brief.id);
    if (byBrief) {
      brief.sessionId = byBrief.id;
      briefSessionBackfill += 1;
    }
  }

  // 2) session.briefId ← brief.sessionId
  for (const brief of briefs) {
    if (!brief.sessionId) continue;
    const sess = sessions.find((s) => s.id === brief.sessionId);
    if (sess && sess.briefId !== brief.id) {
      sess.briefId = brief.id;
      if (sess.status !== "completed" && sess.status !== "failed") {
        sess.status = "completed";
      }
      sessionBriefBackfill += 1;
    }
  }

  // 3) Orphan briefs (no session) on a known project → synthetic completed session
  for (const brief of briefs) {
    if (brief.sessionId) continue;
    if (!projectIds.has(brief.projectId)) continue;

    const existing = sessions.find(
      (s) => s.projectId === brief.projectId && s.briefId === brief.id
    );
    if (existing) {
      brief.sessionId = existing.id;
      briefSessionBackfill += 1;
      continue;
    }

    const now = brief.createdAt || new Date().toISOString();
    const session: AgentSession = {
      id: uid("sess"),
      projectId: brief.projectId,
      question: brief.executiveSummary?.slice(0, 280) || brief.title,
      status: "completed",
      stages: [],
      briefId: brief.id,
      tokensUsed: 0,
      estimatedCostUsd: 0,
      startedAt: now,
      completedAt: now,
      pipelineMode: brief.pipelineMode || "doctrine",
      analysisDepth: brief.analysisDepth || "standard",
      modelUsed: "linked-archive",
    };
    sessions.unshift(session);
    brief.sessionId = session.id;
    syntheticSessions += 1;
    briefSessionBackfill += 1;
  }

  const changed =
    briefSessionBackfill > 0 ||
    sessionBriefBackfill > 0 ||
    syntheticSessions > 0 ||
    staleSessionBriefCleared > 0 ||
    shapeNormalized > 0;
  if (persist && changed) {
    await writeCollection("briefs", briefs);
    for (const session of sessions) {
      await persistSession(session);
    }
  }

  return {
    briefSessionBackfill,
    sessionBriefBackfill,
    syntheticSessions,
    staleSessionBriefCleared,
    shapeNormalized,
    briefs: normalizeBriefs(briefs),
    sessions,
  };
}

/** Latest brief for a project (createdAt desc). */
export function latestBriefForProject(briefs: Brief[], projectId: string): Brief | null {
  const list = briefs
    .filter((b) => b.projectId === projectId)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return list[0] ?? null;
}

/** Prefer a known existing brief id for View result / export links. */
export function resolveLinkedBriefId(opts: {
  sessionBriefId?: string | null;
  latestBriefId?: string | null;
  knownBriefIds: Iterable<string>;
}): string | null {
  const known = new Set(opts.knownBriefIds);
  if (opts.sessionBriefId && known.has(opts.sessionBriefId)) return opts.sessionBriefId;
  if (opts.latestBriefId && known.has(opts.latestBriefId)) return opts.latestBriefId;
  return null;
}

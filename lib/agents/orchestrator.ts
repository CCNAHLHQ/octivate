import { uid, readCollection } from "@/lib/store/json-store";
import { SEED_PROJECTS } from "@/lib/mock/seed";
import type { AgentSession, AnalysisDepth, Project } from "@/lib/types";
import { readOperatorLimits, readUsage } from "@/lib/usage/usage-store";
import { AGENT_DEFS } from "./agent-defs";
import { runDoctrinePipeline, freshDoctrineStages } from "./doctrine-pipeline";
import {
  emitSession,
  getSession,
  listSessions,
  persistSession,
  subscribeSession,
} from "./session-store";
import {
  countRunningSessions,
  findProjectRunningSession,
  recoverStaleSessions,
  supersedeProjectRunningSessions,
} from "./session-lifecycle";

export { AGENT_DEFS, subscribeSession, getSession, listSessions };
export {
  isStaleRunning,
  recoverStaleSessions,
  SUPERSEDED_CODE,
  STALE_TIMEOUT_CODE,
} from "./session-lifecycle";

export type StartAgentPipelineOptions = {
  /** Replace any in-flight run on this project (rerun / topic relaunch). */
  force?: boolean;
  /** Prefer paid model when operator allows premium. */
  usePaidModel?: boolean;
};

export async function startAgentPipeline(
  projectId: string,
  question: string,
  analysisDepth: AnalysisDepth = "standard",
  opts: StartAgentPipelineOptions = {}
): Promise<AgentSession> {
  const force = opts.force === true;
  const preferPremium = opts.usePaidModel === true;

  // Unlock slots + UI left behind by crashed / abandoned workers.
  await recoverStaleSessions();

  const limits = await readOperatorLimits();

  const projects = await readCollection<Project>("projects", SEED_PROJECTS);
  const project = projects.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found");
  if (project.status === "archived") {
    throw new Error("Project is archived — restore it before running a workflow");
  }

  const existing = await findProjectRunningSession(projectId);
  if (existing) {
    if (!force) {
      throw new Error(
        "A workflow is already running for this project. Use Rerun workflow to replace it."
      );
    }
    await supersedeProjectRunningSessions(projectId);
  }

  const running = await countRunningSessions();
  if (running >= limits.concurrentAgents) {
    throw new Error(`Concurrent agent limit reached (${limits.concurrentAgents})`);
  }

  const usage = await readUsage();
  if (usage.tokensUsed >= limits.tokensPerDay) {
    throw new Error("Daily token limit reached");
  }

  const now = new Date().toISOString();
  const session: AgentSession = {
    id: uid("sess"),
    projectId,
    question,
    status: "running",
    stages: freshDoctrineStages(),
    tokensUsed: 0,
    estimatedCostUsd: 0,
    startedAt: now,
    updatedAt: now,
    pipelineMode: "doctrine",
    analysisDepth,
    preferPremium,
  };

  await persistSession(session);
  emitSession(session);

  void runDoctrinePipeline(session, project, question, analysisDepth);

  return session;
}

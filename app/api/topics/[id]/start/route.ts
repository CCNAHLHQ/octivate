import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { findTopicTemplate } from "@/lib/topics/templates";
import { readCollection, writeCollection, uid } from "@/lib/store/json-store";
import { SEED_PROJECTS } from "@/lib/mock/seed";
import { startAgentPipeline } from "@/lib/agents/orchestrator";
import type { AnalysisDepth, Project } from "@/lib/types";
import { z } from "zod";

const bodySchema = z.object({
  run: z.boolean().optional().default(true),
  analysisDepth: z.enum(["rapid", "standard", "deep_dive"]).optional(),
});

/**
 * One-click: create a project from a curated topic template and optionally
 * start the agent pipeline immediately with the template's strategic question.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req, { topics: true });
  if (denied) return denied;
  const { id } = await params;
  const template = findTopicTemplate(id);
  if (!template) return jsonError("Topic template not found", 404);

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  const now = new Date().toISOString();
  const projects = await readCollection<Project>("projects", SEED_PROJECTS);

  // Reuse an existing active project with the same template question if present
  // so repeated clicks don't spam duplicate projects.
  let project =
    projects.find(
      (p) =>
        p.status === "active" &&
        p.name === template.name &&
        p.country === template.country &&
        p.question === template.question
    ) ?? null;

  if (!project) {
    project = {
      id: uid("proj"),
      name: template.name,
      country: template.country,
      sector: template.sector,
      question: template.question,
      documents: template.sources.map((s, i) => ({
        id: uid("doc"),
        name: `${s.title.slice(0, 80)}.md`,
        type: s.type || "Source",
        uploadedAt: now,
      })),
      createdAt: now,
      updatedAt: now,
      status: "active",
    };
    projects.unshift(project);
    await writeCollection("projects", projects);
  } else {
    project = { ...project, updatedAt: now, question: template.question };
    const idx = projects.findIndex((p) => p.id === project!.id);
    if (idx >= 0) {
      projects[idx] = project;
      await writeCollection("projects", projects);
    }
  }

  const depth: AnalysisDepth = parsed.data.analysisDepth ?? template.suggestedDepth;
  let session = null;
  if (parsed.data.run) {
    try {
      // Topic relaunch reuses the project — always supersede a stuck/prior run.
      session = await startAgentPipeline(project.id, template.question, depth, {
        force: true,
      });
    } catch (err) {
      return jsonOk(
        {
          project,
          session: null,
          started: false,
          error: err instanceof Error ? err.message : "Pipeline failed to start",
        },
        { status: 201 }
      );
    }
  }

  return jsonOk({ project, session, started: !!session, templateId: template.id }, { status: 201 });
}

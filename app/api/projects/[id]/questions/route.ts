import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { askQuestionSchema } from "@/lib/validation/schemas";
import { startAgentPipeline } from "@/lib/agents/orchestrator";
import { readCollection, writeCollection } from "@/lib/store/json-store";
import { SEED_PROJECTS } from "@/lib/mock/seed";
import type { Project } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req, { pipeline: true });
  if (denied) return denied;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const parsed = askQuestionSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  const projects = await readCollection<Project>("projects", SEED_PROJECTS);
  const idx = projects.findIndex((p) => p.id === id);
  if (idx < 0) return jsonError("Project not found", 404);

  try {
    const session = await startAgentPipeline(
      id,
      parsed.data.question,
      parsed.data.analysisDepth || "standard",
      {
        force: parsed.data.force === true,
        usePaidModel: parsed.data.usePaidModel === true,
      }
    );

    const now = new Date().toISOString();
    projects[idx] = {
      ...projects[idx],
      question: parsed.data.question,
      updatedAt: now,
    };
    await writeCollection("projects", projects);

    return jsonOk({ session }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start pipeline";
    const status = message.includes("limit") ? 429 : message.includes("not found") ? 404 : 500;
    return jsonError(message, status);
  }
}

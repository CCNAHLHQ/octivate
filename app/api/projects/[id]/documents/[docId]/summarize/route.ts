import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { readCollection } from "@/lib/store/json-store";
import { SEED_PROJECTS } from "@/lib/mock/seed";
import { summarizeProjectDocument } from "@/lib/docs/summarize";
import { assertProjectAccess, resolveRequestUser } from "@/lib/auth/scope";
import type { Project } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const denied = guardApi(req, { summarize: true });
  if (denied) return denied;
  const { id, docId } = await params;

  const projects = await readCollection<Project>("projects", SEED_PROJECTS);
  const project = projects.find((p) => p.id === id);
  if (!project) return jsonError("Project not found", 404);
  const user = await resolveRequestUser(req);
  const access = assertProjectAccess(project, user);
  if (!access.ok) return jsonError(access.error, access.status);

  try {
    const body = (await req.json().catch(() => ({}))) as { focus?: unknown };
    const focus =
      typeof body.focus === "string" ? body.focus.trim().slice(0, 1_200) : undefined;
    const result = await summarizeProjectDocument({
      projectId: id,
      docId,
      focus: focus || undefined,
    });
    return jsonOk({
      project: result.project,
      document: result.document,
      summary: result.summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Summarize failed";
    return jsonError(message, 502);
  }
}

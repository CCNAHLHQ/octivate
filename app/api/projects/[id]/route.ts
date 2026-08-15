import { promises as fs } from "fs";
import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { readCollection, writeCollection } from "@/lib/store/json-store";
import { SEED_BRIEFS, SEED_PROJECTS } from "@/lib/mock/seed";
import { updateProjectSchema } from "@/lib/validation/schemas";
import { assertProjectAccess, resolveRequestUser } from "@/lib/auth/scope";
import { listSessions, removeSession } from "@/lib/agents/session-store";
import { projectUploadDir } from "@/lib/docs/paths";
import { appendAudit } from "@/lib/protocol/audit";
import type { Brief, Project } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req);
  if (denied) return denied;
  const { id } = await params;
  const projects = await readCollection<Project>("projects", SEED_PROJECTS);
  const project = projects.find((p) => p.id === id);
  if (!project) return jsonError("Project not found", 404);
  const user = await resolveRequestUser(req);
  const access = assertProjectAccess(project, user);
  if (!access.ok) return jsonError(access.error, access.status);
  return jsonOk({ project });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req);
  if (denied) return denied;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  const projects = await readCollection<Project>("projects", SEED_PROJECTS);
  const idx = projects.findIndex((p) => p.id === id);
  if (idx < 0) return jsonError("Project not found", 404);

  const user = await resolveRequestUser(req);
  const access = assertProjectAccess(projects[idx], user);
  if (!access.ok) return jsonError(access.error, access.status);

  projects[idx] = {
    ...projects[idx],
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  };
  await writeCollection("projects", projects);
  return jsonOk({ project: projects[idx] });
}

/** DELETE /api/projects/[id] — hard-delete owned project + cascade briefs/sessions/uploads. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req);
  if (denied) return denied;
  const { id } = await params;

  const projects = await readCollection<Project>("projects", SEED_PROJECTS);
  const idx = projects.findIndex((p) => p.id === id);
  if (idx < 0) return jsonError("Project not found", 404);

  const user = await resolveRequestUser(req);
  const access = assertProjectAccess(projects[idx], user);
  if (!access.ok) return jsonError(access.error, access.status);

  const removed = projects[idx];
  projects.splice(idx, 1);
  await writeCollection("projects", projects);

  const cascade: { collection: string; count: number }[] = [];

  const briefs = await readCollection<Brief>("briefs", SEED_BRIEFS);
  const doomedBriefIds = new Set(
    briefs.filter((b) => b.projectId === id).map((b) => b.id)
  );
  if (doomedBriefIds.size) {
    await writeCollection(
      "briefs",
      briefs.filter((b) => b.projectId !== id)
    );
    cascade.push({ collection: "briefs", count: doomedBriefIds.size });

    const reviews = await readCollection<{ id: string; briefId: string }>(
      "human-reviews",
      []
    );
    const nextReviews = reviews.filter((r) => !doomedBriefIds.has(r.briefId));
    const reviewRemoved = reviews.length - nextReviews.length;
    if (reviewRemoved > 0) {
      await writeCollection("human-reviews", nextReviews);
      cascade.push({ collection: "human-reviews", count: reviewRemoved });
    }
  }

  const sessions = await listSessions();
  const doomedSessions = sessions.filter((s) => s.projectId === id);
  for (const s of doomedSessions) await removeSession(s.id);
  if (doomedSessions.length) {
    cascade.push({ collection: "agent-sessions", count: doomedSessions.length });
  }

  try {
    await fs.rm(projectUploadDir(id), { recursive: true, force: true });
    if (removed.documents?.length) {
      cascade.push({ collection: "uploads", count: removed.documents.length });
    }
  } catch {
    /* best-effort disk cleanup */
  }

  await appendAudit({
    action: "project_deleted",
    detail: `${removed.name} (${id}) · cascade=${JSON.stringify(cascade)}`,
  });

  return jsonOk({ ok: true, id, title: removed.name, cascade });
}

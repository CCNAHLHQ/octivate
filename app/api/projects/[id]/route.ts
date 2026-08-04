import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { readCollection, writeCollection } from "@/lib/store/json-store";
import { SEED_PROJECTS } from "@/lib/mock/seed";
import { updateProjectSchema } from "@/lib/validation/schemas";
import { assertProjectAccess, resolveRequestUser } from "@/lib/auth/scope";
import type { Project } from "@/lib/types";

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

import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk, jsonCached } from "@/lib/security/guard";
import { readCollection, writeCollection, uid } from "@/lib/store/json-store";
import { SEED_PROJECTS } from "@/lib/mock/seed";
import { createProjectSchema } from "@/lib/validation/schemas";
import {
  filterProjectsForUser,
  requireSessionUser,
  resolveRequestUser,
} from "@/lib/auth/scope";
import type { Project } from "@/lib/types";

export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  const projects = await readCollection<Project>("projects", SEED_PROJECTS);
  const user = await resolveRequestUser(req);
  return jsonCached({ projects: filterProjectsForUser(projects, user) });
}

export async function POST(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;

  const user = await resolveRequestUser(req);
  const gate = requireSessionUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  const projects = await readCollection<Project>("projects", SEED_PROJECTS);
  const now = new Date().toISOString();
  const project: Project = {
    id: uid("proj"),
    name: parsed.data.name,
    country: parsed.data.country,
    sector: parsed.data.sector,
    documents: [],
    ownerId: gate.user.id,
    createdAt: now,
    updatedAt: now,
    status: "active",
  };
  projects.unshift(project);
  await writeCollection("projects", projects);
  return jsonOk({ project }, { status: 201 });
}

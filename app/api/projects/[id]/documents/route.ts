import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { readCollection } from "@/lib/store/json-store";
import { SEED_PROJECTS } from "@/lib/mock/seed";
import { saveProjectDocument } from "@/lib/docs/store";
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
  return jsonOk({ documents: project.documents });
}

export async function POST(
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

  const contentType = req.headers.get("content-type") || "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return jsonError("Missing file field");
      const bytes = Buffer.from(await file.arrayBuffer());
      if (!bytes.length) return jsonError("Empty file");
      const { project: next, document } = await saveProjectDocument({
        projectId: id,
        fileName: file.name,
        mime: file.type || "application/octet-stream",
        bytes,
      });
      return jsonOk({ project: next, document }, { status: 201 });
    }

    // Metadata-only uploads create "content not stored on disk" summarize failures.
    return jsonError(
      "Expected multipart/form-data with a file. Metadata-only uploads are not supported.",
      400
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return jsonError(message, 400);
  }
}

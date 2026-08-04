import { NextRequest, NextResponse } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { readCollection } from "@/lib/store/json-store";
import { SEED_PROJECTS } from "@/lib/mock/seed";
import {
  deleteProjectDocument,
  readDocumentBytes,
  type ProjectDocument,
} from "@/lib/docs/store";
import { assertProjectAccess, resolveRequestUser } from "@/lib/auth/scope";
import { sanitizePlainText } from "@/lib/docs/sanitize-text";
import type { Project } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const denied = guardApi(req);
  if (denied) return denied;
  const { id, docId } = await params;

  const projects = await readCollection<Project>("projects", SEED_PROJECTS);
  const project = projects.find((p) => p.id === id);
  if (!project) return jsonError("Project not found", 404);
  const user = await resolveRequestUser(req);
  const access = assertProjectAccess(project, user);
  if (!access.ok) return jsonError(access.error, access.status);

  const doc = project.documents.find((d) => d.id === docId) as ProjectDocument | undefined;
  if (!doc) return jsonError("Document not found", 404);

  const bytes = await readDocumentBytes(id, docId);
  if (!bytes || bytes.length === 0) {
    return jsonError("File content is not available for download", 404);
  }

  const safeName = sanitizePlainText(doc.name, 200).replace(/[^\w.\- ()]+/g, "_") || "document";
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": doc.mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const denied = guardApi(req);
  if (denied) return denied;
  const { id, docId } = await params;

  const projects = await readCollection<Project>("projects", SEED_PROJECTS);
  const project = projects.find((p) => p.id === id);
  if (!project) return jsonError("Project not found", 404);
  const user = await resolveRequestUser(req);
  const access = assertProjectAccess(project, user);
  if (!access.ok) return jsonError(access.error, access.status);

  try {
    const next = await deleteProjectDocument(id, docId);
    return jsonOk({ project: next });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return jsonError(message, message.includes("not found") ? 404 : 400);
  }
}

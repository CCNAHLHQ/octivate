import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { deleteExportTemplate, findExportTemplate, updateExportTemplate } from "@/lib/export/templates-store";
import { updateExportTemplateSchema } from "@/lib/validation/schemas";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const { id } = await params;
  const template = await findExportTemplate(id);
  if (!template) return jsonError("Template not found", 404);
  return jsonOk({ template });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const parsed = updateExportTemplateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  const template = await updateExportTemplate(id, parsed.data);
  if (!template) return jsonError("Template not found", 404);
  return jsonOk({ template });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const { id } = await params;
  const removed = await deleteExportTemplate(id);
  if (!removed) return jsonError("Template not found", 404);
  return jsonOk({ ok: true, id });
}

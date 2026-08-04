import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { appendAudit } from "@/lib/protocol/audit";
import {
  deleteMailTemplate,
  findMailTemplate,
  updateMailTemplate,
} from "@/lib/mail/templates-store";
import { updateMailTemplateSchema } from "@/lib/validation/schemas";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const { id } = await params;
  const template = await findMailTemplate(id);
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

  const parsed = updateMailTemplateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  const template = await updateMailTemplate(id, parsed.data);
  if (!template) return jsonError("Template not found", 404);
  await appendAudit({
    action: "mail_template_updated",
    detail: `${template.name} (${template.kind})`,
  });
  return jsonOk({ template });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const { id } = await params;
  const existing = await findMailTemplate(id);
  const removed = await deleteMailTemplate(id);
  if (!removed) return jsonError("Template not found", 404);
  await appendAudit({
    action: "mail_template_deleted",
    detail: existing ? `${existing.name} (${existing.kind})` : id,
  });
  return jsonOk({ ok: true, id });
}

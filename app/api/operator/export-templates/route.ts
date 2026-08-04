import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import {
  createExportTemplate,
  listExportTemplates,
  reorderExportTemplates,
} from "@/lib/export/templates-store";
import { createExportTemplateSchema, reorderExportTemplatesSchema } from "@/lib/validation/schemas";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  // Operator studio edits live — never serve a stale HTTP-cached list.
  const templates = await listExportTemplates();
  return jsonOk({ templates });
}

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const parsed = createExportTemplateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  const template = await createExportTemplate(parsed.data);
  return jsonOk({ template }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const parsed = reorderExportTemplatesSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  const templates = await reorderExportTemplates(parsed.data.order);
  return jsonOk({ templates });
}

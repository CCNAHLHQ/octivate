import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { duplicateExportTemplate } from "@/lib/export/templates-store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const { id } = await params;
  const template = await duplicateExportTemplate(id);
  if (!template) return jsonError("Template not found", 404);
  return jsonOk({ template }, { status: 201 });
}

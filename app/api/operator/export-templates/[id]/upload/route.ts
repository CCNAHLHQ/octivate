import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { importHtmlBuffer } from "@/lib/export/upload";
import { createExportTemplate, findExportTemplate, updateExportTemplate } from "@/lib/export/templates-store";
import { getOperatorLimits } from "@/lib/auth/profile-limits";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const { id: routeId } = await params;

  const form = await req.formData();
  const file = form.get("file");
  const createNew = form.get("create") === "1";

  if (!(file instanceof File)) return jsonError("Missing file upload");

  const limits = await getOperatorLimits();
  const maxBytes = limits.maxFileSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return jsonError(`File exceeds ${limits.maxFileSizeMb}MB limit`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name || "template.html";

  let templateId = routeId;
  if (createNew || routeId === "new") {
    const created = await createExportTemplate({
      name: fileName.replace(/\.[^.]+$/, ""),
      imported: true,
    });
    templateId = created.id;
  } else {
    const existing = await findExportTemplate(routeId);
    if (!existing) return jsonError("Template not found", 404);
  }

  try {
    const imported = await importHtmlBuffer(templateId, fileName, buffer);
    const template = await updateExportTemplate(templateId, {
      htmlBody: imported.htmlBody,
      sourceFile: imported.sourceFile,
      assetDir: templateId,
      previewText: imported.previewText,
      imported: true,
      name: imported.nameHint,
    });
    return jsonOk({ template }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Import failed");
  }
}

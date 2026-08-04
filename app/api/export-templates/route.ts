import { NextRequest } from "next/server";
import { guardApi, jsonCached } from "@/lib/security/guard";
import { listExportTemplates } from "@/lib/export/templates-store";

/**
 * Workspace-facing list of enabled export skeletons (no operator mutation surface).
 * Prefers the Octivate Decision Brief seed for quick export / brief page.
 */
export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;

  const templates = (await listExportTemplates())
    .filter((t) => t.enabled)
    .map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      supportsFormats: t.supportsFormats,
      enabled: t.enabled,
      sortOrder: t.sortOrder,
    }));

  // Stable default first.
  templates.sort((a, b) => {
    if (a.id === "tpl_octivate_brief") return -1;
    if (b.id === "tpl_octivate_brief") return 1;
    return a.sortOrder - b.sortOrder;
  });

  return jsonCached({ templates, defaultTemplateId: templates[0]?.id ?? "tpl_octivate_brief" });
}

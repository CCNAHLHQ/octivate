import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { buildExportContext, loadExportSources } from "@/lib/export/context";
import { renderStudioPreviewHtml } from "@/lib/export/template-engine";
import { findExportTemplate } from "@/lib/export/templates-store";
import { SEED_BRIEFS } from "@/lib/mock/seed";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const { id } = await params;

  let body: { briefId?: string; htmlBody?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* optional body */
  }

  const template = await findExportTemplate(id);
  if (!template) return jsonError("Template not found", 404);

  const briefId = body.briefId ?? SEED_BRIEFS[0]?.id;
  const sources = briefId ? await loadExportSources(briefId) : null;
  if (!sources) return jsonError("Brief not found for preview", 404);

  const draftTemplate = {
    ...template,
    htmlBody: body.htmlBody ?? template.htmlBody,
  };

  const context = buildExportContext({
    brief: sources.brief,
    project: sources.project,
    session: sources.session,
    template: draftTemplate,
  });

  // renderStudioPreviewHtml is resilient — malformed templates return an in-frame error.
  const html = renderStudioPreviewHtml(draftTemplate.htmlBody, context);
  return jsonOk({ html, context, briefId: sources.brief.id });
}

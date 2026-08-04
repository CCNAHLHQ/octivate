import Mustache from "mustache";
import type { ExportDocumentContext } from "@/lib/export/context";
import { sanitizeExportTemplateHtml } from "@/lib/export/sanitize-options";
import type { ExportTemplate } from "@/lib/types";

Mustache.escape = (value) => {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export function renderExportTemplate(
  template: ExportTemplate,
  context: ExportDocumentContext
): string {
  const raw = Mustache.render(template.htmlBody, context);
  return sanitizeExportTemplateHtml(raw);
}

export function renderSubjectTemplate(template: ExportTemplate, context: ExportDocumentContext) {
  const subject = template.campaignSubject || template.subjectPreset || context.meta.subject;
  return Mustache.render(subject, context);
}

/**
 * Render draft HTML for the operator studio preview.
 * Resilient by design: malformed Mustache (mid-typing `{{ }}`) yields a friendly
 * in-frame message instead of throwing, so the editor never toast-storms.
 */
export function renderStudioPreviewHtml(
  htmlBody: string,
  context: ExportDocumentContext
): string {
  try {
    const rendered = renderExportTemplate(
      {
        id: "preview",
        name: "Preview",
        htmlBody,
        supportsFormats: ["html"],
        sortOrder: 0,
        enabled: true,
        imported: false,
        createdAt: "",
        updatedAt: "",
      },
      context
    );
    return wrapForStudioPreview(rendered);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Template render error";
    return wrapForStudioPreview(renderPreviewError(message));
  }
}

function renderPreviewError(message: string): string {
  const safe = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:24px;color:#b91c1c">
    <strong style="display:block;margin-bottom:8px;font-size:13px">Template preview error</strong>
    <pre style="white-space:pre-wrap;font-size:12px;line-height:1.5;margin:0">${safe}</pre>
  </div>`;
}

/** Operator studio only — iframe-friendly document shell (not used for export output). */
export function wrapForStudioPreview(html: string): string {
  const previewCsp =
    "default-src 'none'; style-src 'unsafe-inline'; img-src data: http: https: blob:; font-src data: http: https:;";
  const style = `<style data-octivate-studio-preview>
    html, body { margin: 0; padding: 0; width: 100%; min-height: 100%; background: #fff; }
    body { overflow-x: hidden; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  </style>`;
  const headExtras = `<meta http-equiv="Content-Security-Policy" content="${previewCsp}" />${style}`;

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${headExtras}</head>`);
  }
  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${headExtras}</head>`);
  }
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />${headExtras}</head><body>${html}</body></html>`;
}

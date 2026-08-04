import type { ExportDocumentContext } from "@/lib/export/context";
import { renderExportTemplate } from "@/lib/export/template-engine";
import type { ExportTemplate } from "@/lib/types";

/** Single rendered HTML document — source of truth for all export formats. */
export function renderDocumentHtml(
  template: ExportTemplate,
  context: ExportDocumentContext
): string {
  return renderExportTemplate(template, context);
}

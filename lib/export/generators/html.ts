import type { ExportDocumentContext } from "@/lib/export/context";
import { buildExportDocument } from "@/lib/export/pipeline";
import type { ExportTemplate } from "@/lib/types";

export function generateHtmlExport(template: ExportTemplate, context: ExportDocumentContext) {
  return buildExportDocument(template, context);
}

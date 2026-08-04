import type { ExportDocumentContext } from "@/lib/export/context";
import { generateDocxExport as generateStructuredDocx } from "@/lib/export/generators/docx";
import { generatePdfExport as generateStructuredPdf } from "@/lib/export/generators/pdf";
import { generatePptxExport as generateStructuredPptx } from "@/lib/export/generators/pptx";
import type { ExportFormat, ExportTemplate } from "@/lib/types";
import { docxFromHtml } from "@/lib/export/pipeline/docx-from-html";
import { canRenderPdfFromHtml, pdfFromHtml } from "@/lib/export/pipeline/pdf-from-html";
import { pptxFromHtml } from "@/lib/export/pipeline/pptx-from-html";
import { prepareExportDocument } from "@/lib/export/pipeline/prepare-document";
import { renderDocumentHtml } from "@/lib/export/pipeline/render-document";

export type TranscodeResult = {
  buffer: Buffer;
  /** Which path produced the file — html-first or structured fallback */
  pipeline: "html" | "structured-fallback";
};

export function buildExportDocument(
  template: ExportTemplate,
  context: ExportDocumentContext
): string {
  const html = renderDocumentHtml(template, context);
  return prepareExportDocument(html);
}

export async function transcodeExport(
  format: ExportFormat,
  template: ExportTemplate,
  context: ExportDocumentContext
): Promise<TranscodeResult> {
  const documentHtml = buildExportDocument(template, context);

  switch (format) {
    case "html":
      return { buffer: Buffer.from(documentHtml, "utf8"), pipeline: "html" };

    case "docx":
      try {
        return { buffer: await docxFromHtml(documentHtml), pipeline: "html" };
      } catch {
        return { buffer: await generateStructuredDocx(template, context), pipeline: "structured-fallback" };
      }

    case "pdf":
      if (canRenderPdfFromHtml()) {
        try {
          return { buffer: await pdfFromHtml(documentHtml), pipeline: "html" };
        } catch {
          /* fall through to structured */
        }
      }
      return { buffer: await generateStructuredPdf(template, context), pipeline: "structured-fallback" };

    case "pptx":
      try {
        return {
          buffer: await pptxFromHtml(documentHtml, { title: context.brief.title }),
          pipeline: "html",
        };
      } catch {
        return { buffer: await generateStructuredPptx(template, context), pipeline: "structured-fallback" };
      }

    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

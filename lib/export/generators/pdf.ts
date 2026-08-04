import { promises as fs } from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import type { ExportDocumentContext } from "@/lib/export/context";
import { renderSubjectTemplate } from "@/lib/export/template-engine";
import type { ExportTemplate } from "@/lib/types";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function addWatermark(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>
) {
  const { width, height } = page.getSize();
  page.drawText("Octivate — Confidential", {
    x: width * 0.12,
    y: height * 0.48,
    size: 28,
    font,
    color: rgb(0.75, 0.78, 0.85),
    opacity: 0.12,
    rotate: degrees(-32),
  });
  page.drawText("Octivate", {
    x: MARGIN,
    y: height - MARGIN + 8,
    size: 9,
    font,
    color: rgb(0.58, 0.2, 0.92),
    opacity: 0.35,
  });
}

export async function generatePdfExport(
  template: ExportTemplate,
  context: ExportDocumentContext
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const subject = renderSubjectTemplate(template, context);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  addWatermark(page, font);

  const drawLine = (text: string, opts?: { bold?: boolean; size?: number; gap?: number }) => {
    const size = opts?.size ?? 11;
    const gap = opts?.gap ?? size + 6;
    const useFont = opts?.bold ? fontBold : font;
    const lines = wrapText(text, opts?.bold ? 62 : 88);
    for (const line of lines) {
      if (y < MARGIN + 40) {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
        addWatermark(page, font);
      }
      page.drawText(line, { x: MARGIN, y, size, font: useFont, color: rgb(0.06, 0.1, 0.18) });
      y -= gap;
    }
  };

  drawLine("Octivate · Decision intelligence brief", { bold: true, size: 10, gap: 18 });
  drawLine(context.brief.title, { bold: true, size: 18, gap: 22 });
  drawLine(`${context.brief.country} · ${context.brief.sector}`, { size: 10 });
  drawLine(`Generated ${context.meta.generatedAtFormatted} · ${context.meta.pipelineLabel}`, { size: 10 });
  drawLine(`Subject: ${subject}`, { size: 10, gap: 16 });

  drawLine("Executive summary", { bold: true, size: 12, gap: 16 });
  drawLine(context.brief.executiveSummary, { size: 11 });
  drawLine(
    `Confidence ${context.brief.confidenceLabel} · Risk ${context.brief.riskLabel}`,
    { size: 10, gap: 16 }
  );

  drawLine("Recommendations", { bold: true, size: 12, gap: 14 });
  for (const rec of context.recommendations) drawLine(`${rec.index}. ${rec.text}`, { size: 10 });

  drawLine("Evidence gaps", { bold: true, size: 12, gap: 14 });
  for (const gap of context.gaps) drawLine(`• ${gap.text}`, { size: 10 });

  drawLine("Power · Systems · Narratives", { bold: true, size: 12, gap: 14 });
  for (const row of context.psnRows.slice(0, 12)) {
    drawLine(`P: ${row.power}`, { size: 9 });
    drawLine(`S: ${row.systems}`, { size: 9 });
    drawLine(`N: ${row.narratives}`, { size: 9, gap: 12 });
  }

  for (const tbl of context.tables) {
    drawLine(tbl.title, { bold: true, size: 12, gap: 14 });
    for (const row of tbl.rows.slice(0, 10)) {
      drawLine(row.cells.join(" · "), { size: 9 });
    }
  }

  drawLine(context.meta.watermarkText, { size: 8, gap: 12 });

  try {
    const logoPath = path.join(process.cwd(), "public", "icon.svg");
    await fs.readFile(logoPath);
  } catch {
    /* svg not embeddable in pdf-lib without conversion */
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}

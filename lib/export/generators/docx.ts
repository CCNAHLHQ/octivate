import { promises as fs } from "fs";
import path from "path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import type { ExportDocumentContext } from "@/lib/export/context";
import { renderSubjectTemplate } from "@/lib/export/template-engine";
import type { ExportTemplate } from "@/lib/types";

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_2) {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });
}

function body(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22 })],
    spacing: { after: 120 },
  });
}

function bullet(text: string) {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 80 },
  });
}

function tableFrom(ctx: ExportDocumentContext, title: string, headers: string[], rows: string[][]) {
  return [
    heading(title),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: headers.map(
            (h) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20 })] })],
              })
          ),
        }),
        ...rows.map(
          (cells) =>
            new TableRow({
              children: cells.map(
                (c) =>
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: c, size: 20 })] })],
                  })
              ),
            })
        ),
      ],
    }),
  ];
}

export async function generateDocxExport(
  template: ExportTemplate,
  context: ExportDocumentContext
): Promise<Buffer> {
  const subject = renderSubjectTemplate(template, context);
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [
        new TextRun({ text: "Octivate", bold: true, size: 32, color: "9333EA" }),
        new TextRun({ text: "  ·  Decision intelligence brief", size: 20, color: "64748B" }),
      ],
      spacing: { after: 200 },
    }),
    heading(context.brief.title, HeadingLevel.HEADING_1),
    body(`${context.brief.country} · ${context.brief.sector} · ${context.meta.generatedAtFormatted}`),
    body(`Subject: ${subject}`),
    body(`Pipeline: ${context.meta.pipelineLabel}`),
    heading("Executive summary"),
    body(context.brief.executiveSummary),
    heading("Assessment"),
    body(`Confidence: ${context.brief.confidenceLabel}   ·   Risk: ${context.brief.riskLabel}`),
  ];

  if (context.riskFactors.length) {
    children.push(heading("Risk factor scores (0–10)"));
    for (const factor of context.riskFactors) {
      children.push(bullet(`${factor.label}: ${factor.score} (${factor.percent}%)`));
    }
  }

  for (const chart of context.charts) {
    children.push(heading(chart.title));
    for (const seg of chart.segments) {
      children.push(bullet(`${seg.label}: ${seg.value} (${seg.percent}%)`));
    }
  }

  children.push(heading("Recommendations"));
  for (const rec of context.recommendations) children.push(bullet(`${rec.index}. ${rec.text}`));

  children.push(heading("Evidence gaps"));
  for (const gap of context.gaps) children.push(bullet(gap.text));

  children.push(
    ...tableFrom(
      context,
      "Power · Systems · Narratives",
      ["Power", "Systems", "Narratives"],
      context.psnRows.map((r) => [r.power, r.systems, r.narratives])
    )
  );

  for (const tbl of context.tables) {
    children.push(
      ...tableFrom(
        context,
        tbl.title,
        tbl.headers,
        tbl.rows.map((r) => r.cells)
      )
    );
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: context.meta.watermarkText,
          italics: true,
          size: 18,
          color: "94A3B8",
        }),
      ],
      spacing: { before: 400 },
      border: { top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" } },
    })
  );

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(doc);
}

export async function tryLoadLogoBytes() {
  try {
    const logoPath = path.join(process.cwd(), "public", "icon.svg");
    return await fs.readFile(logoPath);
  } catch {
    return null;
  }
}

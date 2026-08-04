import PptxGenJS from "pptxgenjs";
import type { ExportDocumentContext } from "@/lib/export/context";
import { renderSubjectTemplate } from "@/lib/export/template-engine";
import type { ExportTemplate } from "@/lib/types";

export async function generatePptxExport(
  template: ExportTemplate,
  context: ExportDocumentContext
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.author = "Octivate";
  pptx.company = "Octivate";
  pptx.subject = renderSubjectTemplate(template, context);
  pptx.title = context.brief.title;

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: "101A2E" };
  titleSlide.addText("Octivate", {
    x: 0.5,
    y: 0.4,
    w: 9,
    fontSize: 14,
    color: "9333EA",
    bold: true,
  });
  titleSlide.addText(context.brief.title, {
    x: 0.5,
    y: 1.2,
    w: 9,
    h: 1.2,
    fontSize: 28,
    color: "F4F7FC",
    bold: true,
  });
  titleSlide.addText(
    `${context.brief.country} · ${context.brief.sector}\n${context.meta.generatedAtFormatted} · ${context.meta.pipelineLabel}`,
    { x: 0.5, y: 2.6, w: 9, fontSize: 12, color: "94A3B8" }
  );
  titleSlide.addText(context.meta.watermarkText, {
    x: 0.5,
    y: 5.0,
    w: 9,
    fontSize: 9,
    color: "64748B",
    italic: true,
  });

  const summarySlide = pptx.addSlide();
  summarySlide.addText("Executive summary", {
    x: 0.5,
    y: 0.35,
    w: 9,
    fontSize: 20,
    color: "9333EA",
    bold: true,
  });
  summarySlide.addText(context.brief.executiveSummary, {
    x: 0.5,
    y: 1.0,
    w: 9,
    h: 2.5,
    fontSize: 14,
    color: "101A2E",
    valign: "top",
  });
  summarySlide.addText(
    `Confidence ${context.brief.confidenceLabel}  ·  Risk ${context.brief.riskLabel}`,
    { x: 0.5, y: 4.0, w: 9, fontSize: 12, color: "475569" }
  );

  const recSlide = pptx.addSlide();
  recSlide.addText("Recommendations", {
    x: 0.5,
    y: 0.35,
    w: 9,
    fontSize: 20,
    color: "9333EA",
    bold: true,
  });
  const recRows = context.recommendations.map((r) => [
    { text: String(r.index), options: { fontSize: 12, color: "9333EA", bold: true } },
    { text: r.text, options: { fontSize: 12, color: "101A2E" } },
  ]);
  recSlide.addTable(recRows as PptxGenJS.TableRow[], {
    x: 0.5,
    y: 1.0,
    w: 9,
    colW: [0.5, 8.5],
    border: { type: "solid", color: "E2E8F0", pt: 1 },
  });

  if (context.riskFactors.length) {
    const riskSlide = pptx.addSlide();
    riskSlide.addText("Risk factor scores", {
      x: 0.5,
      y: 0.35,
      w: 9,
      fontSize: 20,
      color: "9333EA",
      bold: true,
    });
    riskSlide.addChart(
      pptx.ChartType.bar,
      [
        {
          name: "Score",
          labels: context.riskFactors.map((f) => f.label.slice(0, 28)),
          values: context.riskFactors.map((f) => Number(f.score) || 0),
        },
      ],
      {
        x: 0.5,
        y: 1.0,
        w: 9,
        h: 4.0,
        showLegend: false,
        showTitle: true,
        title: `${context.projectName} · 0–10`,
        barGrouping: "clustered",
        valAxisMaxVal: 10,
      }
    );
  }

  const psnChart = context.charts.find((c) => c.id === "psn-counts") || context.charts[1];
  if (psnChart?.segments?.length) {
    const chartSlide = pptx.addSlide();
    chartSlide.addText("PSN coverage", {
      x: 0.5,
      y: 0.35,
      w: 9,
      fontSize: 20,
      color: "9333EA",
      bold: true,
    });
    chartSlide.addChart(
      pptx.ChartType.bar,
      [
        {
          name: "Entities",
          labels: psnChart.segments.map((s) => s.label),
          values: psnChart.segments.map((s) => s.value),
        },
      ],
      {
        x: 0.5,
        y: 1.0,
        w: 9,
        h: 4.0,
        showLegend: false,
        showTitle: true,
        title: psnChart.title,
      }
    );
  }

  if (context.psnRows.length) {
    const psnSlide = pptx.addSlide();
    psnSlide.addText("Power · Systems · Narratives", {
      x: 0.5,
      y: 0.35,
      w: 9,
      fontSize: 20,
      color: "9333EA",
      bold: true,
    });
    const header: PptxGenJS.TableRow = [
      { text: "Power", options: { bold: true, fontSize: 10, color: "64748B" } },
      { text: "Systems", options: { bold: true, fontSize: 10, color: "64748B" } },
      { text: "Narratives", options: { bold: true, fontSize: 10, color: "64748B" } },
    ];
    const rows: PptxGenJS.TableRow[] = [
      header,
      ...context.psnRows.slice(0, 8).map((r) => [
        { text: r.power, options: { fontSize: 10 } },
        { text: r.systems, options: { fontSize: 10 } },
        { text: r.narratives, options: { fontSize: 10 } },
      ]),
    ];
    psnSlide.addTable(rows, {
      x: 0.5,
      y: 1.0,
      w: 9,
      border: { type: "solid", color: "E2E8F0", pt: 1 },
    });
  }

  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return out;
}

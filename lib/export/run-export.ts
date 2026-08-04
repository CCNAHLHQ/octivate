import { promises as fs } from "fs";
import { buildExportContext, loadExportSources } from "@/lib/export/context";
import { transcodeExport } from "@/lib/export/pipeline";
import { EXPORT_OUTPUT_ROOT, exportOutputPath } from "@/lib/export/paths";
import { readCollection, uid, writeCollection } from "@/lib/store/json-store";
import { findExportTemplate } from "@/lib/export/templates-store";
import type { ExportFormat, ExportJob, ExportTemplate } from "@/lib/types";

const MIME: Record<ExportFormat, string> = {
  html: "text/html; charset=utf-8",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

const EXT: Record<ExportFormat, string> = {
  html: "html",
  pdf: "pdf",
  docx: "docx",
  pptx: "pptx",
};

export async function runExport(opts: {
  templateId: string;
  briefId: string;
  format: ExportFormat;
  mock?: boolean;
}) {
  const template = await findExportTemplate(opts.templateId);
  if (!template) throw new Error("Template not found");
  if (!template.enabled) throw new Error("Template is disabled");
  if (!template.supportsFormats.includes(opts.format)) {
    throw new Error(`Template does not support ${opts.format.toUpperCase()} export`);
  }

  const sources = await loadExportSources(opts.briefId);
  if (!sources) throw new Error("Brief not found");

  const context = buildExportContext({
    brief: sources.brief,
    project: sources.project,
    session: sources.session,
    template,
    mock: opts.mock,
  });

  const { buffer } = await transcodeExport(opts.format, template, context);

  await fs.mkdir(EXPORT_OUTPUT_ROOT, { recursive: true });
  const jobId = uid("exp");
  const fileName = `${safeFileName(sources.brief.title)}.${EXT[opts.format]}`;
  const filePath = exportOutputPath(jobId, EXT[opts.format]);
  await fs.writeFile(filePath, buffer);

  const job: ExportJob = {
    id: jobId,
    templateId: template.id,
    briefId: opts.briefId,
    sessionId: sources.session?.id,
    format: opts.format,
    status: "completed",
    outputFile: fileName,
    mock: opts.mock === true,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };

  const jobs = await readCollection<ExportJob>("export-jobs", []);
  jobs.unshift(job);
  await writeCollection("export-jobs", jobs.slice(0, 200));

  return { job, buffer, mime: MIME[opts.format], fileName, context };
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "octivate-export";
}

export function previewExportContext(briefId: string, template: ExportTemplate) {
  return loadExportSources(briefId).then((sources) => {
    if (!sources) return null;
    return buildExportContext({
      brief: sources.brief,
      project: sources.project,
      session: sources.session,
      template,
    });
  });
}

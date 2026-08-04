import type { NextRequest } from "next/server";
import {
  DEFAULT_REGISTRY_CSV,
  importRegistryCsv,
  importRegistryCsvBatch,
  importRegistryFromPath,
  installAndImportRegistry,
  type RegistryBatchImportReport,
  type RegistryImportReport,
} from "@/lib/sources/registry-import";

function isCsvFilename(name: string): boolean {
  return name.toLowerCase().endsWith(".csv");
}

function isCsvMime(type: string): boolean {
  const t = (type || "").toLowerCase();
  return (
    !t ||
    t === "text/csv" ||
    t === "application/csv" ||
    t === "application/vnd.ms-excel" ||
    t === "text/plain" ||
    t === "application/octet-stream"
  );
}

function previewFrom(report: RegistryImportReport | RegistryBatchImportReport) {
  return report.sources
    .slice()
    .sort((a, b) => (b.totalSourceScore ?? 0) - (a.totalSourceScore ?? 0))
    .slice(0, 12)
    .map((s) => ({
      id: s.id,
      title: s.title,
      country: s.country,
      type: s.type,
      watchPriority: s.watchPriority,
      totalSourceScore: s.totalSourceScore,
    }));
}

function collectCsvFiles(form: FormData): File[] {
  const out: File[] = [];
  const seen = new Set<File>();

  for (const key of ["files", "file", "csv"]) {
    for (const value of form.getAll(key)) {
      if (value instanceof File && !seen.has(value)) {
        seen.add(value);
        out.push(value);
      }
    }
  }

  // Any other File parts named *.csv
  form.forEach((value, key) => {
    if (value instanceof File && isCsvFilename(value.name || key) && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  });

  return out;
}

export async function runSourcesImportRequest(req: NextRequest): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const files = collectCsvFiles(form);
    if (!files.length) {
      return { ok: false, status: 400, error: "CSV file(s) required (field: file or files)" };
    }

    const invalid = files.filter((f) => !isCsvFilename(f.name) || !isCsvMime(f.type));
    if (invalid.length) {
      return {
        ok: false,
        status: 400,
        error: `Only .csv documents are accepted (${invalid.map((f) => f.name).join(", ")})`,
      };
    }

    const replaceRaw = String(form.get("replaceAll") ?? "false").toLowerCase();
    const replaceAll = replaceRaw === "true" || replaceRaw === "1";

    const batch = await Promise.all(
      files.map(async (file) => ({
        name: file.name || "upload.csv",
        csv: await file.text(),
      }))
    );

    const report = await importRegistryCsvBatch(batch, { replaceAll });
    const failed = report.fileReports.filter((f) => f.error);
    if (failed.length === report.fileReports.length) {
      return {
        ok: false,
        status: 400,
        error: failed.map((f) => `${f.name}: ${f.error}`).join("; "),
      };
    }

    return {
      ok: true,
      body: {
        ok: true,
        path: report.path,
        files: report.files,
        fileReports: report.fileReports,
        rows: report.rows,
        created: report.created,
        updated: report.updated,
        upserted: report.upserted,
        total: report.sources.length,
        replaceAll,
        sourcesPreview: previewFrom(report),
      },
    };
  }

  const body = (await req.json().catch(() => ({}))) as {
    path?: string;
    csv?: string;
    csvs?: { name?: string; csv: string }[];
    replaceAll?: boolean;
    installFrom?: string;
  };

  const replaceAll =
    body.replaceAll !== undefined
      ? Boolean(body.replaceAll)
      : Boolean(body.csv || body.csvs?.length || body.path || body.installFrom);

  let report: RegistryImportReport | RegistryBatchImportReport;

  if (body.csvs?.length) {
    report = await importRegistryCsvBatch(
      body.csvs.map((c, i) => ({
        name: c.name || `csv_${i + 1}.csv`,
        csv: c.csv,
      })),
      { replaceAll }
    );
  } else if (body.installFrom) {
    report = await installAndImportRegistry(body.installFrom, { replaceAll });
  } else if (body.csv) {
    report = await importRegistryCsv(body.csv, { replaceAll });
    report = { ...report, path: body.path || DEFAULT_REGISTRY_CSV };
  } else {
    report = await importRegistryFromPath(body.path || DEFAULT_REGISTRY_CSV, {
      replaceAll,
    });
  }

  return {
    ok: true,
    body: {
      ok: true,
      path: report.path,
      files: "files" in report ? report.files : [report.path],
      fileReports: "fileReports" in report ? report.fileReports : undefined,
      rows: report.rows,
      created: report.created,
      updated: report.updated,
      upserted: report.upserted,
      total: report.sources.length,
      replaceAll,
      sourcesPreview: previewFrom(report),
    },
  };
}

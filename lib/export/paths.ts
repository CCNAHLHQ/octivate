import path from "path";

export const EXPORT_ASSETS_ROOT = path.join(process.cwd(), "data", "local", "export-assets");
export const EXPORT_OUTPUT_ROOT = path.join(process.cwd(), "data", "local", "export-output");

export function templateAssetDir(templateId: string) {
  return path.join(EXPORT_ASSETS_ROOT, templateId);
}

export function exportOutputPath(jobId: string, ext: string) {
  return path.join(EXPORT_OUTPUT_ROOT, `${jobId}.${ext}`);
}

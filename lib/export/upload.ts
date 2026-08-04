import { promises as fs } from "fs";
import path from "path";
import JSZip from "jszip";
import { sanitizeExportTemplateHtml } from "@/lib/export/sanitize-options";
import { templateAssetDir } from "@/lib/export/paths";

const HTML_EXT = new Set([".html", ".htm"]);
const ALLOWED_ASSET_EXT = new Set([
  ".html",
  ".htm",
  ".css",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".woff",
  ".woff2",
  ".ttf",
]);

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim();
}

/** Plain-text summary of a template's HTML, used for rail search + tooltips. */
export function extractExportPreview(html: string) {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 160);
}

function sanitizeTemplateHtml(html: string) {
  return sanitizeExportTemplateHtml(html);
}

/** Inline a stylesheet into an HTML document so htmlBody stays the single source of truth. */
function inlineStyles(html: string, css: string): string {
  if (!css.trim()) return html;
  const styleBlock = `<style>${css}</style>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${styleBlock}</head>`);
  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${styleBlock}</head>`);
  }
  return `${styleBlock}${html}`;
}

async function writeAssetFile(dir: string, relPath: string, data: Buffer | string) {
  const safeRel = relPath.split(/[/\\]/).map(safeName).join(path.sep);
  const full = path.join(dir, safeRel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return safeRel;
}

export type ImportResult = {
  htmlBody: string;
  sourceFile: string;
  previewText?: string;
  nameHint?: string;
};

export async function importHtmlBuffer(
  templateId: string,
  fileName: string,
  buffer: Buffer
): Promise<ImportResult> {
  const ext = path.extname(fileName).toLowerCase();
  const assetDir = templateAssetDir(templateId);
  await fs.mkdir(assetDir, { recursive: true });

  if (ext === ".zip") {
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.entries(zip.files).filter(([, f]) => !f.dir);

    for (const [rel, file] of entries) {
      const entryExt = path.extname(rel).toLowerCase();
      if (!ALLOWED_ASSET_EXT.has(entryExt)) continue;
      const data = await file.async("nodebuffer");
      await writeAssetFile(assetDir, rel, data);
    }

    const htmlEntry =
      entries.find(([rel]) => /(^|\/)index\.html?$/i.test(rel)) ??
      entries.find(([rel]) => HTML_EXT.has(path.extname(rel).toLowerCase()));

    if (!htmlEntry) throw new Error("ZIP archive must contain at least one HTML file");

    const htmlData = await zip.files[htmlEntry[0]].async("string");
    const cssFiles = entries.filter(([rel]) => path.extname(rel).toLowerCase() === ".css");
    const chunks: string[] = [];
    for (const [rel] of cssFiles.slice(0, 5)) {
      chunks.push(await zip.files[rel].async("string"));
    }
    // Fold external stylesheets into the HTML so preview == export and there's no separate CSS field.
    const htmlBody = sanitizeTemplateHtml(inlineStyles(htmlData, chunks.join("\n")));

    return {
      htmlBody,
      sourceFile: fileName,
      previewText: extractExportPreview(htmlBody),
      nameHint: extractTitle(htmlBody) ?? path.basename(htmlEntry[0], path.extname(htmlEntry[0])),
    };
  }

  if (!HTML_EXT.has(ext)) {
    throw new Error("Only .html, .htm, and .zip files are supported");
  }

  const rel = await writeAssetFile(assetDir, fileName, buffer);
  const htmlBody = sanitizeTemplateHtml(buffer.toString("utf8"));

  return {
    htmlBody,
    sourceFile: rel,
    previewText: extractExportPreview(htmlBody),
    nameHint: extractTitle(htmlBody) ?? path.basename(fileName, ext),
  };
}

export async function cleanupTemplateAssets(templateId: string) {
  const dir = templateAssetDir(templateId);
  await fs.rm(dir, { recursive: true, force: true });
}

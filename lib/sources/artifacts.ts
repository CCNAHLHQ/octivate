import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type {
  CapturePassportBlock,
  CapturePipelineHints,
  CaptureRegistryBlock,
} from "@/lib/sources/capture-descriptors";
import { readProbeConfig } from "@/lib/sources/probe-config";

const ROOT = path.join(process.cwd(), "data", "local", "source-artifacts");

export type ArtifactMeta = {
  sourceId: string;
  sourceTitle?: string;
  url: string;
  startedAt: string;
  finishedAt: string;
  status: "ok" | "failed";
  error?: string;
  statusCode?: number;
  contentType?: string;
  sha256?: string;
  probe?: {
    health?: string;
    healthCheckedAt?: string;
  };
  /** Imported CSV / registry routing descriptors. */
  registry?: CaptureRegistryBlock;
  /** Stable route keys for future pipeline processors. */
  pipeline?: CapturePipelineHints;
};

export type ArtifactDocument = {
  title: string;
  url: string;
  retrievedAt: string;
  text: string;
  links: string[];
  statusCode?: number;
  contentType?: string;
  sha256: string;
  /** Passport narratives from imported source CSVs. */
  passport?: CapturePassportBlock;
};

export function artifactsRoot(): string {
  return ROOT;
}

/** Safe label for UI/API — never expose absolute host paths. */
export function artifactsRootLabel(): string {
  return "local artifact store";
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function removePathWithRetry(full: string, attempts = 4): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      await fs.rm(full, { recursive: true, force: true });
      return true;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") return true;
      const retryable =
        code === "EBUSY" || code === "EPERM" || code === "EACCES" || code === "ENOTEMPTY";
      if (retryable && i < attempts - 1) {
        await wait(180 * (i + 1));
        continue;
      }
      return false;
    }
  }
  return false;
}

/** Remove every source artifact folder under the capture root. */
export async function clearAllArtifactBundles(): Promise<{
  removed: number;
  failed: number;
}> {
  let removed = 0;
  let failed = 0;
  try {
    const entries = await fs.readdir(ROOT, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(ROOT, entry.name);
      const ok = await removePathWithRetry(full);
      if (ok) removed += 1;
      else failed += 1;
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") throw err;
  }
  await ensureDir(ROOT);
  return { removed, failed };
}

export function sourceArtifactDir(sourceId: string): string {
  return path.join(ROOT, sanitizeSegment(sourceId));
}

export function compactTimestamp(d = new Date()): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "unknown";
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function readLatestPointer(
  sourceId: string
): Promise<{ folder: string; at: string; status?: string } | null> {
  try {
    const raw = await fs.readFile(path.join(sourceArtifactDir(sourceId), "latest.json"), "utf8");
    return JSON.parse(raw) as { folder: string; at: string; status?: string };
  } catch {
    return null;
  }
}

export async function writeCaptureBundle(opts: {
  sourceId: string;
  sourceTitle?: string;
  url: string;
  html: string;
  document: Omit<ArtifactDocument, "sha256"> & { sha256?: string };
  meta: Omit<ArtifactMeta, "finishedAt" | "sha256"> & { finishedAt?: string };
}): Promise<{ folder: string; dir: string }> {
  const cfg = await readProbeConfig();
  const maxHtml = cfg.captureMaxHtmlBytes;
  const folder = compactTimestamp();
  const base = sourceArtifactDir(opts.sourceId);
  const tmp = path.join(base, `.tmp-${folder}`);
  const finalDir = path.join(base, folder);

  await ensureDir(base);
  await ensureDir(tmp);

  const html = opts.html.slice(0, maxHtml);
  const sha256 = createHash("sha256").update(html).digest("hex");
  const document: ArtifactDocument = {
    ...opts.document,
    text: opts.document.text.slice(0, maxHtml),
    sha256: opts.document.sha256 || sha256,
  };
  const meta: ArtifactMeta = {
    ...opts.meta,
    finishedAt: opts.meta.finishedAt || new Date().toISOString(),
    sha256,
  };

  await fs.writeFile(path.join(tmp, "page.html"), html, "utf8");
  await fs.writeFile(path.join(tmp, "document.json"), JSON.stringify(document, null, 2), "utf8");
  await fs.writeFile(path.join(tmp, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
  await fs.writeFile(
    path.join(tmp, "README.txt"),
    [
      "Octivate source capture bundle",
      `sourceId: ${opts.sourceId}`,
      `url: ${opts.url}`,
      `folder: ${folder}`,
      "",
      "Files:",
      "  page.html      — captured page markup",
      "  document.json  — extracted text/links + passport narratives from registry CSV",
      "  meta.json      — fetch status + registry routing + pipeline route hints",
      "",
      meta.pipeline?.routes?.length
        ? `pipeline.routes: ${meta.pipeline.routes.join(", ")}`
        : "pipeline.routes: (none)",
    ].join("\n"),
    "utf8"
  );

  await fs.rename(tmp, finalDir);

  if (meta.status === "ok") {
    await fs.writeFile(
      path.join(base, "latest.json"),
      JSON.stringify(
        {
          folder,
          at: meta.finishedAt,
          status: meta.status,
          url: opts.url,
          routes: meta.pipeline?.routes || [],
          briefUse: meta.registry?.briefUse,
          watchPriority: meta.registry?.watchPriority,
        },
        null,
        2
      ),
      "utf8"
    );
  }

  await pruneOldCaptures(opts.sourceId, cfg.captureMaxVersions);
  return { folder, dir: finalDir };
}

async function pruneOldCaptures(sourceId: string, keep: number) {
  const base = sourceArtifactDir(sourceId);
  let entries: string[] = [];
  try {
    entries = (await fs.readdir(base)).filter(
      (name) => /^\d{8}T\d{6}Z$/.test(name) || /^\d{8}T\d{6}\.\d+Z$/.test(name)
    );
  } catch {
    return;
  }
  entries.sort().reverse();
  for (const name of entries.slice(keep)) {
    await fs.rm(path.join(base, name), { recursive: true, force: true }).catch(() => null);
  }
}

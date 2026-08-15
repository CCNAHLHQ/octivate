import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";
import {
  readLatestPointer,
  sourceArtifactDir,
  type ArtifactDocument,
  type ArtifactMeta,
} from "@/lib/sources/artifacts";
import { labelTextFromSource } from "@/lib/evidence/labeler";
import type { EvidenceDocument } from "@/lib/evidence/types";
import type { Source } from "@/lib/types";
import { uid } from "@/lib/store/json-store";

export type LatestCaptureBundle = {
  folder: string;
  document: ArtifactDocument;
  meta: ArtifactMeta | null;
};

/** Read newest successful capture document.json (+ meta) for a source. */
export async function readLatestCaptureBundle(
  sourceId: string
): Promise<LatestCaptureBundle | null> {
  const ptr = await readLatestPointer(sourceId);
  if (!ptr?.folder) return null;
  const dir = path.join(sourceArtifactDir(sourceId), ptr.folder);
  try {
    const raw = await fs.readFile(path.join(dir, "document.json"), "utf8");
    const document = JSON.parse(raw) as ArtifactDocument;
    let meta: ArtifactMeta | null = null;
    try {
      meta = JSON.parse(await fs.readFile(path.join(dir, "meta.json"), "utf8")) as ArtifactMeta;
    } catch {
      meta = null;
    }
    return { folder: ptr.folder, document, meta };
  } catch {
    return null;
  }
}

export async function evidenceFromCapture(
  source: Source,
  opts?: { projectId?: string; question?: string; projectSector?: string; maxChars?: number }
): Promise<EvidenceDocument | null> {
  const bundle = await readLatestCaptureBundle(source.id);
  if (!bundle?.document?.text?.trim()) return null;

  const maxChars = opts?.maxChars ?? 40_000;
  const text = bundle.document.text.slice(0, maxChars);
  const passport = bundle.document.passport;
  const registry = bundle.meta?.registry;
  const pipeline = bundle.meta?.pipeline;
  const labels = labelTextFromSource(
    text,
    source,
    opts?.question || "",
    opts?.projectSector || ""
  );

  return {
    id: uid("evd"),
    sourceId: source.id,
    projectId: opts?.projectId,
    title: bundle.document.title || source.title,
    url: bundle.document.url || source.primaryRetrievalUrl || source.url,
    text,
    sha256: bundle.document.sha256 || createHash("sha256").update(text).digest("hex"),
    channels: [
      {
        kind: "capture_text",
        text,
        confidence: 0.85,
        extractedAt: bundle.document.retrievedAt || new Date().toISOString(),
        path: `${source.id}/${bundle.folder}/document.json`,
      },
    ],
    labels,
    routes: pipeline?.routes || source.lastCaptureRoutes || [],
    registry,
    passport,
    pipeline,
    captureFolder: bundle.folder,
    capturedAt: bundle.meta?.finishedAt || bundle.document.retrievedAt,
    createdAt: new Date().toISOString(),
  };
}

/** Load evidence docs for a set of curated sources (best-effort). */
export async function loadCaptureEvidenceForSources(
  sources: Source[],
  opts?: { projectId?: string; question?: string; projectSector?: string; maxChars?: number }
): Promise<EvidenceDocument[]> {
  const out: EvidenceDocument[] = [];
  for (const source of sources) {
    const doc = await evidenceFromCapture(source, opts);
    if (doc) out.push(doc);
  }
  return out;
}

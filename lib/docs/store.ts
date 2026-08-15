import fs from "fs/promises";
import path from "path";
import { documentBlobPath, projectUploadDir, assertAllowedFilename } from "@/lib/docs/paths";
import { computeDocumentExpiresAt } from "@/lib/docs/retention";
import { sanitizePlainText } from "@/lib/docs/sanitize-text";
import {
  contentSha256,
  extractOctivateBrief,
  looksLikeOctivateBrief,
} from "@/lib/docs/brief-import";
import { uid, readCollection, writeCollection } from "@/lib/store/json-store";
import { SEED_PROJECTS } from "@/lib/mock/seed";
import { getOperatorLimits } from "@/lib/auth/profile-limits";
import type { Project } from "@/lib/types";

export type ProjectDocument = Project["documents"][number];

const TEXT_EXTS = new Set([".txt", ".md", ".csv", ".html", ".htm"]);

/** Patches that count as a material file change for retention clock reset. */
const MATERIAL_PATCH_KEYS = new Set([
  "name",
  "summary",
  "summaryAt",
  "summaryPayload",
  "mime",
  "size",
  "type",
]);

export async function ensureUploadDir(projectId: string) {
  await fs.mkdir(projectUploadDir(projectId), { recursive: true });
}

export async function saveProjectDocument(opts: {
  projectId: string;
  fileName: string;
  mime: string;
  bytes: Buffer;
}): Promise<{ project: Project; document: ProjectDocument }> {
  assertAllowedFilename(opts.fileName);
  const projects = await readCollection<Project>("projects", SEED_PROJECTS);
  const idx = projects.findIndex((p) => p.id === opts.projectId);
  if (idx < 0) throw new Error("Project not found");

  const limits = await getOperatorLimits();
  if (projects[idx].documents.length >= limits.maxUploadsPerProject) {
    throw new Error(`Upload limit reached (${limits.maxUploadsPerProject} per project)`);
  }
  const maxBytes = limits.maxFileSizeMb * 1024 * 1024;
  if (opts.bytes.length > maxBytes) {
    throw new Error(`File exceeds the ${limits.maxFileSizeMb} MB limit`);
  }

  const now = new Date().toISOString();
  const docId = uid("doc");
  if (opts.bytes.length === 0) {
    throw new Error("Empty file — upload requires stored content");
  }
  await ensureUploadDir(opts.projectId);
  await fs.writeFile(documentBlobPath(opts.projectId, docId), opts.bytes);

  const ext = path.extname(opts.fileName).toLowerCase().replace(".", "").toUpperCase() || "FILE";
  const hash = opts.bytes.length ? contentSha256(opts.bytes) : undefined;
  let kind: ProjectDocument["kind"] = "file";
  let importPayload: ProjectDocument["importPayload"];
  let summaryStatus: ProjectDocument["summaryStatus"] = "idle";
  let summary: string | undefined;
  let summaryPayload: ProjectDocument["summaryPayload"];

  // Fast path: recognize re-uploaded Octivate HTML/text briefs without LLM.
  const sniffExt = path.extname(opts.fileName).toLowerCase();
  if (
    opts.bytes.length > 0 &&
    (sniffExt === ".html" || sniffExt === ".htm" || sniffExt === ".txt" || sniffExt === ".md")
  ) {
    const raw = opts.bytes.toString("utf8");
    if (looksLikeOctivateBrief(raw)) {
      const extracted = extractOctivateBrief(raw, { contentHash: hash });
      if (extracted) {
        kind = "octivate_brief";
        importPayload = extracted;
        summaryStatus = "ready";
        summary = sanitizePlainText(
          [
            `Recognized prior Octivate brief: ${extracted.title}.`,
            extracted.executiveSummary.slice(0, 400),
            "Pipeline can hydrate this brief without a full doctrine run.",
          ].join(" "),
          1_200
        );
        summaryPayload = {
          status: "imported_octivate_brief",
          key_points: [
            ...extracted.recommendations.slice(0, 3),
            ...extracted.power.slice(0, 2),
          ],
          decision_relevance: extracted.analyticalJudgement || extracted.executiveSummary.slice(0, 400),
          gaps: extracted.gaps.slice(0, 6),
          risk_flags: extracted.riskLevel ? [`risk:${extracted.riskLevel}`] : [],
          review_flags: ["import_shortcut_available"],
        };
      }
    }
  }

  const doc: ProjectDocument = {
    id: docId,
    name: sanitizePlainText(opts.fileName, 240),
    type: ext,
    mime: opts.mime || "application/octet-stream",
    size: opts.bytes.length,
    uploadedAt: now,
    changedAt: now,
    expiresAt: computeDocumentExpiresAt({ uploadedAt: now, changedAt: now }, limits.documentRetentionDays),
    summaryStatus,
    summary,
    summaryAt: summary ? now : undefined,
    summaryPayload,
    contentHash: hash,
    kind,
    importPayload,
  };

  projects[idx] = {
    ...projects[idx],
    documents: [...projects[idx].documents, doc],
    updatedAt: now,
  };
  await writeCollection("projects", projects);
  return { project: projects[idx], document: doc };
}

export async function deleteProjectDocument(projectId: string, docId: string) {
  const projects = await readCollection<Project>("projects", SEED_PROJECTS);
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx < 0) throw new Error("Project not found");
  const before = projects[idx].documents.length;
  const nextDocs = projects[idx].documents.filter((d) => d.id !== docId);
  if (nextDocs.length === before) throw new Error("Document not found");

  projects[idx] = {
    ...projects[idx],
    documents: nextDocs,
    updatedAt: new Date().toISOString(),
  };
  await writeCollection("projects", projects);

  try {
    await fs.unlink(documentBlobPath(projectId, docId));
  } catch {
    /* blob may be missing for legacy metadata-only docs */
  }
  return projects[idx];
}

export async function readDocumentBytes(projectId: string, docId: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(documentBlobPath(projectId, docId));
  } catch {
    // Seed / demo docs historically had metadata only — hydrate fixture bytes once.
    try {
      const { ensureSeedDocumentBlob } = await import("@/lib/docs/seed-blobs");
      const seeded = await ensureSeedDocumentBlob(projectId, docId);
      if (seeded.ok) {
        return await fs.readFile(documentBlobPath(projectId, docId));
      }
    } catch {
      /* fall through */
    }
    return null;
  }
}

/** Best-effort text extraction for summarizer — never executes content. */
export async function extractDocumentText(
  projectId: string,
  doc: ProjectDocument,
  maxChars = 80_000
): Promise<{ text: string; mode: "text" | "binary_meta" }> {
  const bytes = await readDocumentBytes(projectId, doc.id);
  const ext = path.extname(doc.name).toLowerCase();
  if (!bytes) {
    return {
      text: sanitizePlainText(`Document "${doc.name}" (${doc.type}) — content not stored on disk.`),
      mode: "binary_meta",
    };
  }
  // Backfill size/mime for seed docs hydrated on first read.
  if ((!doc.size || doc.size <= 0) && bytes.length > 0) {
    void patchDocumentMeta(projectId, doc.id, {
      size: bytes.length,
      mime: doc.mime || (TEXT_EXTS.has(ext) ? "text/markdown" : doc.mime),
    }).catch(() => undefined);
  }
  if (TEXT_EXTS.has(ext)) {
    const raw = bytes.toString("utf8");
    return { text: sanitizePlainText(raw, maxChars), mode: "text" };
  }

  if (ext === ".pdf" || ext === ".docx" || ext === ".doc") {
    const { extractBinaryDocument } = await import("@/lib/evidence/extract");
    const extracted = await extractBinaryDocument(bytes, ext, maxChars);
    if (extracted) {
      return {
        text: extracted.text,
        mode: extracted.mode === "binary_meta" ? "binary_meta" : "text",
      };
    }
  }

  // Sniff UTF-8; if mostly printable, treat as text. Else metadata only.
  const sample = bytes.slice(0, Math.min(bytes.length, 8_000)).toString("utf8");
  const printable = sample.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "").length;
  if (printable / Math.max(sample.length, 1) > 0.85) {
    return { text: sanitizePlainText(sample, maxChars), mode: "text" };
  }
  return {
    text: sanitizePlainText(
      `Binary document "${doc.name}" (${doc.mime || doc.type}, ${doc.size ?? bytes.length} bytes). No full-text extract available; summarize decision relevance from file identity and project context only.`
    ),
    mode: "binary_meta",
  };
}

export async function patchDocumentMeta(
  projectId: string,
  docId: string,
  patch: Partial<ProjectDocument>
) {
  const projects = await readCollection<Project>("projects", SEED_PROJECTS);
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx < 0) throw new Error("Project not found");
  const dIdx = projects[idx].documents.findIndex((d) => d.id === docId);
  if (dIdx < 0) throw new Error("Document not found");

  const material = Object.keys(patch).some((k) => MATERIAL_PATCH_KEYS.has(k));
  const docs = [...projects[idx].documents];
  const prev = docs[dIdx];
  let next: ProjectDocument = { ...prev, ...patch };

  if (material) {
    const limits = await getOperatorLimits();
    const changedAt = new Date().toISOString();
    next = {
      ...next,
      changedAt,
      expiresAt: computeDocumentExpiresAt(
        { uploadedAt: next.uploadedAt, changedAt },
        limits.documentRetentionDays
      ),
    };
  }

  docs[dIdx] = next;
  projects[idx] = { ...projects[idx], documents: docs, updatedAt: new Date().toISOString() };
  await writeCollection("projects", projects);
  return { project: projects[idx], document: docs[dIdx] as ProjectDocument };
}

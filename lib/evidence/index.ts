import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { evidenceFromCapture } from "@/lib/evidence/capture-load";
import { extractDocumentText } from "@/lib/docs/store";
import { evidenceFromMachineTranscript } from "@/lib/evidence/transcript-load";
import { labelTextFromSource } from "@/lib/evidence/labeler";
import type { EvidenceDocument } from "@/lib/evidence/types";
import { readJobs } from "@/lib/parliamentary/store";
import { mediaRoot } from "@/lib/parliamentary/paths";
import { readCollection, uid, writeCollection, writeObject, readObject } from "@/lib/store/json-store";
import { SEED_SOURCES } from "@/lib/mock/seed";
import type { Project, Source } from "@/lib/types";

const INDEX_KEY = "evidence-index-manifest";

export type EvidenceIndexEntry = {
  sourceId: string;
  kind: "capture" | "parliamentary" | "upload";
  sha256: string;
  title: string;
  path?: string;
  updatedAt: string;
  charCount: number;
};

export type EvidenceIndexManifest = {
  updatedAt: string;
  entries: EvidenceIndexEntry[];
};

function indexRoot() {
  return path.join(process.cwd(), "data", "local", "evidence-index");
}

async function ensureIndexDir() {
  await fs.mkdir(indexRoot(), { recursive: true });
}

/** Stable parl source id from job identity. */
export function parlSourceId(job: {
  id: string;
  vimeoId?: string;
  mediaUrl?: string;
}): string {
  if (job.vimeoId) return `parl_vimeo_${job.vimeoId}`;
  const m = String(job.mediaUrl || "").match(/vimeo\.com\/(?:video\/)?(\d{6,12})/i);
  if (m?.[1]) return `parl_vimeo_${m[1]}`;
  return `parl_job_${job.id}`;
}

export async function readEvidenceIndexManifest(): Promise<EvidenceIndexManifest> {
  return readObject<EvidenceIndexManifest>(INDEX_KEY, {
    updatedAt: new Date().toISOString(),
    entries: [],
  });
}

async function writeEvidenceIndexManifest(manifest: EvidenceIndexManifest) {
  await writeObject(INDEX_KEY, manifest);
  await ensureIndexDir();
  await fs.writeFile(
    path.join(indexRoot(), "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );
}

function upsertEntry(entries: EvidenceIndexEntry[], next: EvidenceIndexEntry) {
  const i = entries.findIndex((e) => e.sourceId === next.sourceId && e.kind === next.kind);
  if (i >= 0) entries[i] = next;
  else entries.push(next);
}

/**
 * Load all local evidence for a project run:
 * capture artifacts for selected sources, done parl transcripts, project upload extracts.
 */
export async function loadLocalEvidenceBundle(
  sources: Source[],
  project: Project,
  question: string,
  opts?: { includeParl?: boolean; includeUploads?: boolean; maxChars?: number }
): Promise<{
  evidence: EvidenceDocument[];
  sourcesWithLocalText: Set<string>;
  manifest: EvidenceIndexManifest;
}> {
  const maxChars = opts?.maxChars ?? 14_000;
  const evidence: EvidenceDocument[] = [];
  const sourcesWithLocalText = new Set<string>();
  const entries: EvidenceIndexEntry[] = [];

  for (const source of sources) {
    const doc = await evidenceFromCapture(source, {
      projectId: project.id,
      question,
      projectSector: project.sector,
      maxChars,
    });
    if (doc?.text?.trim()) {
      evidence.push(doc);
      sourcesWithLocalText.add(source.id);
      upsertEntry(entries, {
        sourceId: source.id,
        kind: "capture",
        sha256: doc.sha256 || createHash("sha256").update(doc.text).digest("hex"),
        title: doc.title,
        path: doc.channels[0]?.path,
        updatedAt: doc.capturedAt || doc.createdAt,
        charCount: doc.text.length,
      });
    }
  }

  if (opts?.includeParl !== false) {
    const jobs = await readJobs();
    const done = jobs.filter(
      (j) =>
        (j.stage === "done" || j.transcriptStatus === "octivate_machine_transcript") &&
        j.folder
    );
    for (const job of done) {
      const sid = parlSourceId(job);
      const doc = await evidenceFromMachineTranscript({
        folder: job.folder,
        projectId: project.id,
        sourceId: sid,
        maxChars,
        sourceHint: {
          id: sid,
          title: job.title,
          country: job.country,
          psnLayers: ["Power", "Systems", "Narratives"],
          sectorTags: ["Parliamentary", "Governance"],
        },
        question,
        projectSector: project.sector,
      });
      if (!doc?.text?.trim()) continue;
      // Prefer matching registry source if already upserted
      const registryMatch = sources.find((s) => s.id === sid);
      if (registryMatch) doc.sourceId = registryMatch.id;
      evidence.push(doc);
      if (doc.sourceId) sourcesWithLocalText.add(doc.sourceId);
      upsertEntry(entries, {
        sourceId: doc.sourceId || sid,
        kind: "parliamentary",
        sha256: doc.sha256 || createHash("sha256").update(doc.text).digest("hex"),
        title: doc.title,
        path: doc.captureFolder,
        updatedAt: doc.createdAt,
        charCount: doc.text.length,
      });
    }
  }

  if (opts?.includeUploads !== false) {
    const docs = project.documents || [];
    for (const d of docs) {
      const sid = `upload_${project.id}_${d.id}`;
      const fakeSource: Source = {
        id: sid,
        title: d.name,
        tier: 3,
        country: project.country,
        type: "Project upload",
        health: "healthy",
        lastChecked: new Date().toISOString(),
        sectorTags: [project.sector],
        psnLayers: ["Power", "Systems", "Narratives"],
        userRelevance: [],
      };

      // Prefer question-conditioned summary payload + extract hybrid so briefs
      // retain structured decision context without dropping quotable text.
      const extracted = await extractDocumentText(project.id, d, maxChars);
      const payload = d.summaryPayload;
      const summaryReady = d.summaryStatus === "ready" && (d.summary || payload);
      const structured = summaryReady
        ? [
            d.summary || "",
            payload?.decision_relevance
              ? `Decision relevance: ${payload.decision_relevance}`
              : "",
            (payload?.key_points || []).length
              ? `Key points:\n${(payload?.key_points || []).map((k) => `- ${k}`).join("\n")}`
              : "",
            (payload?.recommendation_hints || []).length
              ? `Recommendation hints:\n${(payload?.recommendation_hints || [])
                  .map((k) => `- ${k}`)
                  .join("\n")}`
              : "",
            (payload?.gaps || []).length
              ? `Gaps: ${(payload?.gaps || []).join("; ")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n")
        : "";

      let body = "";
      if (structured && extracted.text?.trim() && extracted.mode !== "binary_meta") {
        body = `${structured}\n\n--- Grounding extract ---\n${extracted.text}`.slice(0, maxChars);
      } else if (structured) {
        body = structured.slice(0, maxChars);
      } else if (extracted.mode !== "binary_meta" && extracted.text.trim()) {
        if (/content not stored|No full-text extract|not supported/i.test(extracted.text)) {
          continue;
        }
        body = extracted.text.slice(0, maxChars);
      } else {
        continue;
      }

      const sha = createHash("sha256").update(body).digest("hex");
      const labels = labelTextFromSource(body, fakeSource, question, project.sector);
      const ev: EvidenceDocument = {
        id: uid("evd"),
        sourceId: sid,
        projectId: project.id,
        title: d.name,
        text: body,
        sha256: sha,
        channels: [
          {
            kind: "upload",
            text: body,
            confidence: summaryReady ? 0.82 : 0.7,
            extractedAt: new Date().toISOString(),
            notes: summaryReady
              ? `project_upload_summary_hybrid:${payload?.method || "summary"}`
              : "project_upload_extract",
          },
        ],
        labels,
        routes: ["project-upload"],
        createdAt: new Date().toISOString(),
      };
      evidence.push(ev);
      sourcesWithLocalText.add(sid);
      upsertEntry(entries, {
        sourceId: sid,
        kind: "upload",
        sha256: sha,
        title: d.name,
        updatedAt: new Date().toISOString(),
        charCount: ev.text.length,
      });
    }
  }

  const manifest: EvidenceIndexManifest = {
    updatedAt: new Date().toISOString(),
    entries,
  };
  await writeEvidenceIndexManifest(manifest).catch(() => undefined);

  return { evidence, sourcesWithLocalText, manifest };
}

/**
 * Upsert a registry Source for a finished parliamentary transcript job.
 * Idempotent by parlSourceId (vimeo / job).
 */
export async function upsertParlTranscriptSource(job: {
  id: string;
  title: string;
  country: string;
  folder?: string;
  mediaUrl?: string;
  pageUrl?: string;
  vimeoId?: string;
  durationSec?: number;
}): Promise<Source | null> {
  if (!job.folder) return null;
  const id = parlSourceId(job);
  const now = new Date().toISOString();
  const folderRel = path.isAbsolute(job.folder)
    ? path.relative(process.cwd(), job.folder).replace(/\\/g, "/")
    : job.folder.replace(/\\/g, "/");

  // Ensure transcript exists under media root when absolute
  const abs = path.isAbsolute(job.folder)
    ? job.folder
    : path.join(process.cwd(), job.folder);
  try {
    await fs.access(path.join(abs, "transcript.jsonl"));
  } catch {
    return null;
  }

  const sources = await readCollection<Source>("sources", SEED_SOURCES);
  const idx = sources.findIndex((s) => s.id === id);
  const base: Source = {
    id,
    title: job.title || `Parliamentary transcript ${job.vimeoId || job.id}`,
    tier: 2,
    country: job.country || "Regional",
    countries: job.country ? [job.country] : ["Regional"],
    type: "Parliamentary video transcript",
    typePreset: "parliamentary",
    url: job.pageUrl || job.mediaUrl,
    primaryRetrievalUrl: job.mediaUrl || job.pageUrl,
    psnLayers: ["Power", "Systems", "Narratives"],
    sectorTags: ["Parliamentary", "Governance", "Legislature"],
    userRelevance: ["hansard_adjacent", "octivate_machine_transcript"],
    watchPriority: "Secondary",
    retrievalPriority: "High",
    briefUse: "Direct Citation",
    reliabilityScore: 70,
    timelinessScore: 80,
    signalValueScore: 75,
    decisionUsefulnessScore: 78,
    totalSourceScore: 76,
    health: "healthy",
    lastChecked: now,
    lastCaptureAt: now,
    lastCaptureFolder: folderRel,
    lastCaptureRoutes: ["parliamentary-video"],
    notes: `Local Octivate machine transcript (never Hansard). Job ${job.id}.`,
    sourceSummary: `Machine transcript of parliamentary media for ${job.country}.`,
    whyThisSourceMatters:
      "Provides locally stored spoken proceedings text for citation and PSN grounding.",
  };

  if (idx >= 0) {
    sources[idx] = {
      ...sources[idx],
      ...base,
      title: job.title || sources[idx].title,
      lastCaptureAt: now,
      lastCaptureFolder: folderRel,
      lastChecked: now,
    };
  } else {
    sources.push(base);
  }

  await writeCollection("sources", sources);
  return idx >= 0 ? sources[idx] : base;
}

/** Whether a source has any local evidence on disk (capture or parl folder). */
export async function sourceHasLocalEvidence(source: Source): Promise<boolean> {
  if (source.lastCaptureFolder || source.lastCaptureAt) {
    const doc = await evidenceFromCapture(source, { maxChars: 200 });
    if (doc?.text?.trim()) return true;
  }
  if (source.id.startsWith("parl_") && source.lastCaptureFolder) {
    const doc = await evidenceFromMachineTranscript({
      folder: source.lastCaptureFolder,
      sourceId: source.id,
      maxChars: 200,
    });
    if (doc?.text?.trim()) return true;
  }
  // Probe media root for this source id folder pointer
  if (source.lastCaptureRoutes?.includes("parliamentary-video") && source.lastCaptureFolder) {
    return true;
  }
  return false;
}

export async function listLocalEvidenceBadges(
  sources: Source[]
): Promise<Map<string, ("capture" | "parliamentary" | "none")[]>> {
  const map = new Map<string, ("capture" | "parliamentary" | "none")[]>();
  for (const s of sources) {
    const badges: ("capture" | "parliamentary" | "none")[] = [];
    const cap = await evidenceFromCapture(s, { maxChars: 80 }).catch(() => null);
    if (cap?.text?.trim()) badges.push("capture");
    if (
      s.id.startsWith("parl_") ||
      s.lastCaptureRoutes?.includes("parliamentary-video")
    ) {
      if (s.lastCaptureFolder) badges.push("parliamentary");
    }
    if (!badges.length) badges.push("none");
    map.set(s.id, badges);
  }
  return map;
}

/** Ensure media root exists (for tests / ops). */
export function evidenceMediaRoot() {
  return mediaRoot();
}

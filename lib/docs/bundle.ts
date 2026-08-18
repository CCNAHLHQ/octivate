/**
 * Cross-document evidence bundle — stitches per-doc summaries / extracts into
 * one theatre-relative pack for doctrine, PSN lenses, and recommendations.
 *
 * Ranking covers every project upload; packing uses fair per-doc budgets so
 * later docs are not silently dropped by a single prefix truncate.
 */

import { extractDocumentText, type ProjectDocument } from "@/lib/docs/store";
import { findSupportingPassages } from "@/lib/evidence/citations";
import { sanitizePlainText } from "@/lib/docs/sanitize-text";
import type { Project } from "@/lib/types";

export type BundledDocumentSlice = {
  docId: string;
  name: string;
  method: "summary_payload" | "extract_passages" | "summary_text" | "meta_only";
  summary: string;
  key_points: string[];
  /** Substantive decision relevance only — never synthetic extraction labels. */
  decision_relevance: string;
  gaps: string[];
  risk_flags: string[];
  passages: string[];
  /** Internal retrieval diagnostics — not client-facing. */
  retrievalNote?: string;
  overlapScore?: number;
  extractionQuality?: "strong" | "weak" | "none";
  internalFlags?: string[];
};

export type DocumentEvidenceBundle = {
  question: string;
  projectId: string;
  method: "structured_merge";
  documents: BundledDocumentSlice[];
  /** Prompt-ready theatre brief for agents. */
  theatreBrief: string;
  recommendationHints: string[];
  gaps: string[];
  riskFlags: string[];
  psnHints: {
    power: string[];
    systems: string[];
    narratives: string[];
  };
  charCount: number;
  /** Doc ids packed into this bundle (ranked order). */
  includedDocIds: string[];
  /** Doc ids omitted because the char budget could not fit them fairly. */
  skippedDocIds: string[];
  /** True when at least one upload was omitted for budget. */
  truncated: boolean;
  /** Char budget used when packing the theatre brief. */
  charBudget: number;
  /** Total uploads considered for ranking. */
  totalDocs: number;
  /** Optional human-readable coverage note. */
  note?: string;
};

/** Minimum useful chars reserved per included doc when packing. */
const MIN_PER_DOC_CHARS = 320;

type ProjectDoc = Project["documents"][number];

function classifyPsnHint(text: string): "power" | "systems" | "narratives" | null {
  const t = text.toLowerCase();
  if (/power|minister|authority|stakeholder|owner|actor|influence|coalition/.test(t)) {
    return "power";
  }
  if (/system|process|tariff|regulation|capacity|infrastructure|procedure|timeline/.test(t)) {
    return "systems";
  }
  if (/narrative|media|public|perception|framing|legitimacy|discourse/.test(t)) {
    return "narratives";
  }
  return null;
}

function questionKeywords(question: string): string[] {
  return String(question || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
}

function keywordOverlapScore(doc: ProjectDoc, keywords: string[]): number {
  if (!keywords.length) return 0;
  const hay = [
    doc.name || "",
    doc.summary || "",
    doc.summaryPayload?.decision_relevance || "",
  ]
    .join("\n")
    .toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (hay.includes(kw)) hits += 1;
  }
  return hits;
}

/**
 * Rank every upload: ready summaries first, then question keyword overlap on
 * name/summary/relevance, then original upload order (stable).
 */
function rankProjectDocuments(docs: ProjectDoc[], question: string): ProjectDoc[] {
  const keywords = questionKeywords(question);
  return docs
    .map((doc, uploadOrder) => ({
      doc,
      uploadOrder,
      ready: doc.summaryStatus === "ready" ? 1 : 0,
      overlap: keywordOverlapScore(doc, keywords),
    }))
    .sort((a, b) => {
      if (b.ready !== a.ready) return b.ready - a.ready;
      if (b.overlap !== a.overlap) return b.overlap - a.overlap;
      return a.uploadOrder - b.uploadOrder;
    })
    .map((row) => row.doc);
}

/** How many leading ranked docs fit under a fair share of `available`. */
function fairIncludeCount(totalRanked: number, availableChars: number): number {
  if (totalRanked <= 0 || availableChars < MIN_PER_DOC_CHARS) return 0;
  const maxByMin = Math.floor(availableChars / MIN_PER_DOC_CHARS);
  return Math.max(0, Math.min(totalRanked, maxByMin));
}

function clipText(text: string, maxChars: number): string {
  const s = String(text || "").trim();
  if (maxChars <= 0 || !s) return "";
  if (s.length <= maxChars) return s;
  return s.slice(0, Math.max(0, maxChars - 1)) + "…";
}

/** Render one slice into a compact prompt block, clipped to `budget` chars. */
function formatSliceBlock(slice: BundledDocumentSlice, index: number, budget: number): string {
  if (budget <= 0) return "";

  const header = `### Doc ${index + 1} [${slice.docId}] ${slice.name} (${slice.method})`;
  const parts: string[] = [header];
  let used = header.length + 1;

  const push = (label: string, body: string) => {
    const remaining = budget - used;
    if (remaining <= 24 || !body.trim()) return;
    const line = `${label}${clipText(body, remaining - label.length)}`;
    parts.push(line);
    used += line.length + 1;
  };

  push("Summary: ", slice.summary);
  push("Decision relevance: ", slice.decision_relevance);

  if (slice.key_points.length && budget - used > 40) {
    const kpLabel = "Key points:\n";
    const remaining = budget - used - kpLabel.length;
    const lines: string[] = [];
    let kpUsed = 0;
    for (const kp of slice.key_points) {
      const line = `- ${kp}`;
      if (kpUsed + line.length + 1 > remaining) break;
      lines.push(line);
      kpUsed += line.length + 1;
    }
    if (lines.length) {
      const block = kpLabel + lines.join("\n");
      parts.push(block);
      used += block.length + 1;
    }
  }

  if (slice.passages.length && budget - used > 40) {
    const pLabel = "Grounding passages:\n";
    const remaining = budget - used - pLabel.length;
    const lines: string[] = [];
    let pUsed = 0;
    for (const p of slice.passages) {
      const line = `- ${p}`;
      if (pUsed + line.length + 1 > remaining) {
        const room = remaining - pUsed - 2;
        if (room > 40) lines.push(`- ${clipText(p, room)}`);
        break;
      }
      lines.push(line);
      pUsed += line.length + 1;
    }
    if (lines.length) {
      const block = pLabel + lines.join("\n");
      parts.push(block);
      used += block.length + 1;
    }
  }

  if (slice.gaps.length) push("Gaps: ", slice.gaps.join("; "));
  if (slice.risk_flags.length) push("Risk flags: ", slice.risk_flags.join("; "));

  const joined = parts.join("\n");
  return clipText(joined, budget);
}

function theatreHeader(
  question: string,
  project: Project,
  included: number,
  total: number,
  truncated: boolean
): string {
  return [
    `Document evidence bundle for decision: ${question}`,
    `Theatre: ${project.name} · ${project.country} · ${project.sector}`,
    `Documents bundled: ${included} of ${total} (method=structured_merge${truncated ? ", truncated" : ""}).`,
    "",
  ].join("\n");
}

const THEATRE_FOOTER =
  "\n\nUse this bundle to ground Power / Systems / Narrative findings and to keep recommendations informational, option-distinct, and tied to uploaded evidence. Do not invent coverage.";

/**
 * Rebuild a prompt from included slices with equal per-doc char shares.
 * Does not prefix-truncate a concatenated theatreBrief (that drops later docs).
 */
function packSlicesIntoBrief(
  slices: BundledDocumentSlice[],
  question: string,
  project: Project,
  totalDocs: number,
  maxChars: number
): string {
  const truncated = slices.length < totalDocs;
  const header = theatreHeader(question, project, slices.length, totalDocs, truncated);
  const footer = THEATRE_FOOTER;
  const overhead = header.length + footer.length;
  const available = Math.max(0, maxChars - overhead);

  if (!slices.length || available < MIN_PER_DOC_CHARS) {
    return sanitizePlainText(header.trim() + footer, maxChars);
  }

  const perDoc = Math.max(MIN_PER_DOC_CHARS, Math.floor(available / slices.length));
  const blocks = slices.map((s, i) => formatSliceBlock(s, i, perDoc));
  const brief = `${header}${blocks.join("\n\n")}${footer}`;
  return sanitizePlainText(brief, maxChars);
}

/** Operator / agent-facing coverage line. */
export function coverageNote(bundle: DocumentEvidenceBundle): string {
  if (bundle.note) return bundle.note;
  const used = bundle.includedDocIds.length;
  const total = bundle.totalDocs;
  const omitted = bundle.skippedDocIds.length;
  if (omitted <= 0) {
    return `Used ${used} of ${total} uploads.`;
  }
  return `Used ${used} of ${total} uploads; ${omitted} omitted for prompt budget.`;
}

async function buildSliceForDoc(
  project: Project,
  doc: ProjectDoc,
  question: string,
  opts: { maxPassageChars: number; extractMaxChars: number; softCharCap: number }
): Promise<BundledDocumentSlice> {
  const soft = Math.max(MIN_PER_DOC_CHARS, opts.softCharCap);
  const payload = doc.summaryPayload;

  if (doc.summaryStatus === "ready" && (payload || doc.summary)) {
    return {
      docId: doc.id,
      name: doc.name,
      method: payload ? "summary_payload" : "summary_text",
      summary: sanitizePlainText(doc.summary || "", Math.min(3_000, soft)),
      key_points: (payload?.key_points || []).slice(0, 12),
      decision_relevance: sanitizePlainText(
        payload?.decision_relevance || "",
        Math.min(1_500, soft)
      ),
      gaps: (payload?.gaps || []).slice(0, 10),
      risk_flags: (payload?.risk_flags || []).slice(0, 10),
      passages: [],
    };
  }

  const extracted = await extractDocumentText(
    project.id,
    doc as ProjectDocument,
    opts.extractMaxChars
  );
  if (extracted.mode === "binary_meta" || !extracted.text.trim()) {
    return {
      docId: doc.id,
      name: doc.name,
      method: "meta_only",
      summary: sanitizePlainText(extracted.text.slice(0, 400), 400),
      key_points: [],
      decision_relevance: "",
      gaps: ["No full-text extract available for this upload."],
      risk_flags: [],
      passages: [],
    };
  }

  const passages = findSupportingPassages(extracted.text, question, {
    max: 3,
    windowChars: opts.maxPassageChars,
    title: doc.name,
  });
  const fallback =
    passages.length > 0
      ? passages.map((p) => p.text)
      : [extracted.text.replace(/\s+/g, " ").trim().slice(0, opts.maxPassageChars)];

  const weakOverlap = passages.length === 0;
  return {
    docId: doc.id,
    name: doc.name,
    method: "extract_passages",
    summary: sanitizePlainText(fallback[0] || "", Math.min(2_000, soft)),
    key_points: fallback.slice(1, 4).map((p) => sanitizePlainText(p, Math.min(800, soft))),
    // Substantive relevance = passage content only; never synthetic pipeline labels.
    decision_relevance: sanitizePlainText(
      passages[0]?.text?.slice(0, 400) || "",
      Math.min(800, soft)
    ),
    gaps: [],
    risk_flags: [],
    passages: fallback,
    retrievalNote: weakOverlap
      ? `Weak keyword overlap with decision question for ${doc.name}`
      : `Question-conditioned extract from ${doc.name}`,
    overlapScore: passages.length ? Math.min(1, passages[0].score || 0.5) : 0.15,
    extractionQuality: weakOverlap ? "weak" : "strong",
    internalFlags: weakOverlap ? ["weak_keyword_overlap"] : [],
  };
}

/**
 * Build a bundled, question-conditioned view of all project uploads.
 * Prefers structured summaryPayload; falls back to extract passages.
 * No LLM call — deterministic merge for pipeline reliability.
 */
export async function buildDocumentEvidenceBundle(
  project: Project,
  question: string,
  opts?: {
    /** @deprecated Ranking always considers every upload; this no longer caps ranking. */
    maxDocs?: number;
    maxPassageChars?: number;
    extractMaxChars?: number;
    /** Theatre-brief packing budget (fairly split across included docs). */
    charBudget?: number;
  }
): Promise<DocumentEvidenceBundle> {
  const maxPassageChars = opts?.maxPassageChars ?? 900;
  const extractMaxChars = opts?.extractMaxChars ?? 28_000;
  const charBudget = opts?.charBudget ?? 48_000;

  const allDocs = [...(project.documents || [])];
  const totalDocs = allDocs.length;
  const ranked = rankProjectDocuments(allDocs, question);

  const headerProbe = theatreHeader(question, project, ranked.length, totalDocs, false);
  const available = Math.max(0, charBudget - headerProbe.length - THEATRE_FOOTER.length);
  const includeCount = fairIncludeCount(ranked.length, available);
  const softCharCap =
    includeCount > 0 ? Math.max(MIN_PER_DOC_CHARS, Math.floor(available / includeCount)) : MIN_PER_DOC_CHARS;

  const toInclude = ranked.slice(0, includeCount);
  const skippedDocs = ranked.slice(includeCount);
  const includedDocIds = toInclude.map((d) => d.id);
  const skippedDocIds = skippedDocs.map((d) => d.id);
  const truncated = skippedDocIds.length > 0;

  const slices: BundledDocumentSlice[] = [];
  for (const d of toInclude) {
    slices.push(
      await buildSliceForDoc(project, d, question, {
        maxPassageChars,
        extractMaxChars,
        softCharCap,
      })
    );
  }

  const recommendationHints: string[] = [];
  const gaps: string[] = [];
  const riskFlags: string[] = [];
  const psnHints = { power: [] as string[], systems: [] as string[], narratives: [] as string[] };

  for (const s of slices) {
    for (const kp of s.key_points) {
      // Only substantive content becomes recommendation / PSN prompt context.
      if (/question-conditioned extract|weak keyword overlap/i.test(kp)) continue;
      recommendationHints.push(`${s.name}: ${kp}`);
      const layer = classifyPsnHint(kp);
      if (layer && psnHints[layer].length < 6) psnHints[layer].push(kp);
    }
    if (
      s.decision_relevance &&
      !/question-conditioned extract|weak keyword overlap/i.test(s.decision_relevance)
    ) {
      recommendationHints.push(`${s.name}: ${s.decision_relevance}`);
      const layer = classifyPsnHint(s.decision_relevance);
      if (layer && psnHints[layer].length < 6) psnHints[layer].push(s.decision_relevance);
    }
    // Real evidence-access failures only (ignore internalFlags / weak-overlap diagnostics).
    for (const g of s.gaps) {
      if (/weak keyword overlap|question-conditioned/i.test(g)) continue;
      gaps.push(`${s.name}: ${g}`);
    }
    riskFlags.push(...s.risk_flags.map((r) => `${s.name}: ${r}`));
  }

  const theatreBrief = packSlicesIntoBrief(slices, question, project, totalDocs, charBudget);
  const note =
    truncated
      ? `Used ${includedDocIds.length} of ${totalDocs} uploads; ${skippedDocIds.length} omitted for prompt budget.`
      : `Used ${includedDocIds.length} of ${totalDocs} uploads.`;

  return {
    question,
    projectId: project.id,
    method: "structured_merge",
    documents: slices,
    theatreBrief,
    recommendationHints: recommendationHints.slice(0, 20).map((x) => sanitizePlainText(x, 1_600)),
    gaps: gaps.slice(0, 24),
    riskFlags: riskFlags.slice(0, 20),
    psnHints: {
      power: psnHints.power.slice(0, 8),
      systems: psnHints.systems.slice(0, 8),
      narratives: psnHints.narratives.slice(0, 8),
    },
    charCount: theatreBrief.length,
    includedDocIds,
    skippedDocIds,
    truncated,
    charBudget,
    totalDocs,
    note,
  };
}

/**
 * Compact block for runAgent document context.
 * Fairly allocates maxChars across included slices — does not prefix-slice theatreBrief.
 */
export function formatDocumentBundleForAgent(
  bundle: DocumentEvidenceBundle,
  maxChars = 18_000
): string {
  // Rebuild from slices so later docs keep a fair share (never prefix-slice theatreBrief).
  if (bundle.documents?.length) {
    const truncated = bundle.truncated || bundle.includedDocIds.length < bundle.totalDocs;
    const header = [
      `Document evidence bundle for decision: ${bundle.question}`,
      `Documents bundled: ${bundle.documents.length} of ${bundle.totalDocs}` +
        ` (method=structured_merge${truncated ? ", truncated" : ""}).`,
      coverageNote(bundle),
      "",
    ].join("\n");
    const footer = THEATRE_FOOTER;
    const overhead = header.length + footer.length;
    const available = Math.max(0, maxChars - overhead);

    if (available < MIN_PER_DOC_CHARS) {
      return sanitizePlainText(header.trim() + footer, maxChars);
    }

    const perDoc = Math.max(MIN_PER_DOC_CHARS, Math.floor(available / bundle.documents.length));
    const blocks = bundle.documents.map((s, i) => formatSliceBlock(s, i, perDoc));
    return sanitizePlainText(`${header}${blocks.join("\n\n")}${footer}`, maxChars);
  }

  // Fallback if slices are missing (should not happen for fresh bundles).
  return sanitizePlainText(bundle.theatreBrief || "", maxChars);
}

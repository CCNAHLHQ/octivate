/**
 * Cross-document evidence bundle — stitches per-doc summaries / extracts into
 * one theatre-relative pack for doctrine, PSN lenses, and recommendations.
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
  decision_relevance: string;
  gaps: string[];
  risk_flags: string[];
  passages: string[];
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
};

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

/**
 * Build a bundled, question-conditioned view of all project uploads.
 * Prefers structured summaryPayload; falls back to extract passages.
 * No LLM call — deterministic merge for pipeline reliability.
 */
export async function buildDocumentEvidenceBundle(
  project: Project,
  question: string,
  opts?: { maxDocs?: number; maxPassageChars?: number; extractMaxChars?: number }
): Promise<DocumentEvidenceBundle> {
  const maxDocs = opts?.maxDocs ?? 12;
  const maxPassageChars = opts?.maxPassageChars ?? 900;
  const extractMaxChars = opts?.extractMaxChars ?? 28_000;
  const docs = (project.documents || []).slice(0, maxDocs);
  const slices: BundledDocumentSlice[] = [];

  for (const d of docs) {
    const payload = d.summaryPayload;
    if (d.summaryStatus === "ready" && (payload || d.summary)) {
      slices.push({
        docId: d.id,
        name: d.name,
        method: payload ? "summary_payload" : "summary_text",
        summary: sanitizePlainText(d.summary || "", 3_000),
        key_points: (payload?.key_points || []).slice(0, 12),
        decision_relevance: sanitizePlainText(payload?.decision_relevance || "", 1_500),
        gaps: (payload?.gaps || []).slice(0, 10),
        risk_flags: (payload?.risk_flags || []).slice(0, 10),
        passages: [],
      });
      continue;
    }

    const extracted = await extractDocumentText(project.id, d as ProjectDocument, extractMaxChars);
    if (extracted.mode === "binary_meta" || !extracted.text.trim()) {
      slices.push({
        docId: d.id,
        name: d.name,
        method: "meta_only",
        summary: sanitizePlainText(extracted.text.slice(0, 400), 400),
        key_points: [],
        decision_relevance: "",
        gaps: ["No full-text extract available for this upload."],
        risk_flags: [],
        passages: [],
      });
      continue;
    }

    const passages = findSupportingPassages(extracted.text, question, {
      max: 3,
      windowChars: maxPassageChars,
      title: d.name,
    });
    const fallback =
      passages.length > 0
        ? passages.map((p) => p.text)
        : [extracted.text.replace(/\s+/g, " ").trim().slice(0, maxPassageChars)];

    slices.push({
      docId: d.id,
      name: d.name,
      method: "extract_passages",
      summary: sanitizePlainText(fallback[0] || "", 2_000),
      key_points: fallback.slice(1, 4).map((p) => sanitizePlainText(p, 800)),
      decision_relevance: sanitizePlainText(
        `Question-conditioned extract from ${d.name} for: ${question.slice(0, 200)}`,
        800
      ),
      gaps: passages.length ? [] : ["Weak keyword overlap with decision question — treat cautiously."],
      risk_flags: [],
      passages: fallback,
    });
  }

  const recommendationHints: string[] = [];
  const gaps: string[] = [];
  const riskFlags: string[] = [];
  const psnHints = { power: [] as string[], systems: [] as string[], narratives: [] as string[] };

  for (const s of slices) {
    for (const kp of s.key_points) {
      recommendationHints.push(`${s.name}: ${kp}`);
      const layer = classifyPsnHint(kp);
      if (layer && psnHints[layer].length < 6) psnHints[layer].push(kp);
    }
    if (s.decision_relevance) {
      recommendationHints.push(`${s.name} · relevance: ${s.decision_relevance}`);
      const layer = classifyPsnHint(s.decision_relevance);
      if (layer && psnHints[layer].length < 6) psnHints[layer].push(s.decision_relevance);
    }
    gaps.push(...s.gaps.map((g) => `${s.name}: ${g}`));
    riskFlags.push(...s.risk_flags.map((r) => `${s.name}: ${r}`));
  }

  const theatreBrief = [
    `Document evidence bundle for decision: ${question}`,
    `Theatre: ${project.name} · ${project.country} · ${project.sector}`,
    `Documents bundled: ${slices.length} (method=structured_merge).`,
    "",
    ...slices.map((s, i) =>
      [
        `### Doc ${i + 1} [${s.docId}] ${s.name} (${s.method})`,
        s.summary ? `Summary: ${s.summary}` : null,
        s.decision_relevance ? `Decision relevance: ${s.decision_relevance}` : null,
        s.key_points.length ? `Key points:\n${s.key_points.map((k) => `- ${k}`).join("\n")}` : null,
        s.passages.length
          ? `Grounding passages:\n${s.passages.map((p) => `- ${p.slice(0, 2_400)}`).join("\n")}`
          : null,
        s.gaps.length ? `Gaps: ${s.gaps.join("; ")}` : null,
        s.risk_flags.length ? `Risk flags: ${s.risk_flags.join("; ")}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    ),
    "",
    "Use this bundle to ground Power / Systems / Narrative findings and to keep recommendations informational, option-distinct, and tied to uploaded evidence. Do not invent coverage.",
  ].join("\n");

  return {
    question,
    projectId: project.id,
    method: "structured_merge",
    documents: slices,
    theatreBrief: sanitizePlainText(theatreBrief, 72_000),
    recommendationHints: recommendationHints.slice(0, 20).map((x) => sanitizePlainText(x, 1_600)),
    gaps: gaps.slice(0, 24),
    riskFlags: riskFlags.slice(0, 20),
    psnHints: {
      power: psnHints.power.slice(0, 8),
      systems: psnHints.systems.slice(0, 8),
      narratives: psnHints.narratives.slice(0, 8),
    },
    charCount: theatreBrief.length,
  };
}

/** Compact block for runAgent document context. */
export function formatDocumentBundleForAgent(
  bundle: DocumentEvidenceBundle,
  maxChars = 18_000
): string {
  return bundle.theatreBrief.slice(0, maxChars);
}

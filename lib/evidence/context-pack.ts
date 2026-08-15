import type { EvidenceDocument } from "@/lib/evidence/types";
import type { Project, Source } from "@/lib/types";

/** Build untrusted context block for evidence_manager / lenses. */
export function buildEvidenceContextPack(opts: {
  baseContext: string;
  evidence: EvidenceDocument[];
  project: Project;
  question: string;
  maxPerDoc?: number;
}): string {
  const maxPerDoc = opts.maxPerDoc ?? 2200;
  if (!opts.evidence.length) {
    return [
      opts.baseContext,
      "",
      "Local evidence: none available for selected sources yet. Prefer registry URLs; do not invent page text.",
    ].join("\n");
  }

  const blocks = opts.evidence.map((doc, i) => {
    const labels = doc.labels
      .slice(0, 12)
      .map((l) => `${l.kind}:${l.value}(${l.weight.toFixed(2)})`)
      .join(", ");
    const routes = (doc.routes || []).slice(0, 10).join(", ");
    const kind =
      doc.routes?.includes("parliamentary-video")
        ? "parliamentary transcript"
        : doc.routes?.includes("project-upload")
          ? "project upload"
          : "capture";
    return [
      `### Local evidence ${i + 1} (${kind}) [${doc.sourceId || doc.id}] ${doc.title}`,
      doc.url ? `URL: ${doc.url}` : null,
      doc.captureFolder ? `Artifact folder: ${doc.captureFolder}` : null,
      labels ? `Labels: ${labels}` : null,
      routes ? `Pipeline routes: ${routes}` : null,
      "Extracted text:",
      doc.text.slice(0, maxPerDoc),
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    opts.baseContext,
    "",
    `Local evidence pack (capture + parl transcripts + uploads) for theatre ${opts.project.country} / ${opts.project.sector}.`,
    `Decision question (for relevance only): ${opts.question.slice(0, 400)}`,
    "Use this text as primary page evidence when citing these source IDs. Do not invent quotes.",
    "Upload channels may include structured summaryPayload hybrid text — prefer decision_relevance and key points for recommendations and PSN, and grounding extract for citations.",
    "",
    ...blocks,
  ].join("\n");
}

export function enrichRecordRelevance(
  sourceId: string,
  evidence: EvidenceDocument[],
  fallback?: string
): string | undefined {
  const doc = evidence.find((e) => e.sourceId === sourceId);
  if (!doc) return fallback;
  const labelHint = doc.labels
    .filter((l) => l.kind === "sector" || l.kind === "psn")
    .slice(0, 4)
    .map((l) => l.value)
    .join("; ");
  const snippet = doc.text.replace(/\s+/g, " ").trim().slice(0, 280);
  return [labelHint ? `Labels: ${labelHint}` : null, snippet || fallback]
    .filter(Boolean)
    .join(" — ");
}

export function sourcesWithLocalText(
  sources: Source[],
  localIds?: Set<string>
): Source[] {
  return sources.filter(
    (s) =>
      Boolean(s.lastCaptureAt || s.lastCaptureFolder) ||
      Boolean(localIds?.has(s.id)) ||
      s.id.startsWith("parl_") ||
      s.id.startsWith("upload_")
  );
}

/** @deprecated use sourcesWithLocalText */
export function sourcesWithCapture(sources: Source[]): Source[] {
  return sourcesWithLocalText(sources);
}

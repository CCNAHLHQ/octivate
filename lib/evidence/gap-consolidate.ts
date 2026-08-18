/**
 * Evidence-gap consolidation — drop scratchpad, resolve contradictions,
 * only surface decision-material unresolved gaps to the client brief.
 */

import { uid } from "@/lib/store/json-store";
import type { EvidenceGap, EvidenceGapCategory } from "@/lib/types";

const SCRATCHPAD_RE =
  /\b(actually re-?reading|let me check|i need to|as an ai|upon further|wait[, ]|scratchpad|thinking out loud)\b/i;

const THEATRE_MISMATCH_RE = /theatre\s*mismatch|off[- ]?theatre|wrong theatre/i;

const STOCK_UX_RE =
  /add documents that speak directly|Keep the decision question specific to the theatre|Off-scope or unrelated uploads are not treated/i;

const PIPELINE_META_RE =
  /question-conditioned extract|weak keyword overlap|pipeline metadata|schema_validation/i;

function classifyGap(text: string): EvidenceGapCategory {
  if (SCRATCHPAD_RE.test(text) || PIPELINE_META_RE.test(text)) return "pipeline_qa";
  if (/uncertain|unclear|cannot (?:verify|confirm)|unknown/i.test(text)) {
    return "analytical_uncertainty";
  }
  if (/status|deadline|rfp|eoi|current|verified|procurement/i.test(text)) {
    return "evidence_gap";
  }
  if (/not sufficient|does not provide investment positioning|no source provides investment positioning/i.test(text)) {
    return "non_gap";
  }
  return "evidence_gap";
}

function materialityOf(text: string): EvidenceGap["materiality"] {
  if (/decision-critical|current .+ status|cannot verify|unknown/i.test(text)) {
    return "decision_critical";
  }
  if (/material|procurement|deadline|rfp|eoi/i.test(text)) return "material";
  return "minor";
}

export function consolidateEvidenceGaps(raw: string[]): {
  clientGaps: string[];
  structured: EvidenceGap[];
} {
  const structured: EvidenceGap[] = [];
  const seen = new Set<string>();

  for (const rawGap of raw) {
    const text = String(rawGap || "").trim();
    if (!text) continue;
    if (STOCK_UX_RE.test(text)) continue;

    if (SCRATCHPAD_RE.test(text) || THEATRE_MISMATCH_RE.test(text)) {
      structured.push({
        gap_id: uid("gap"),
        category: "pipeline_qa",
        missing_information: text,
        materiality: "minor",
        status: "internal",
        internal_only: true,
        confidence: 0.2,
      });
      continue;
    }

    const category = classifyGap(text);
    if (category === "pipeline_qa" || category === "non_gap") {
      structured.push({
        gap_id: uid("gap"),
        category,
        missing_information: text,
        materiality: "minor",
        status: "internal",
        internal_only: true,
        confidence: 0.4,
      });
      continue;
    }

    const key = text.toLowerCase().replace(/\s+/g, " ").slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);

    const materiality = materialityOf(text);
    const gap: EvidenceGap = {
      gap_id: uid("gap"),
      category,
      missing_information: text,
      materiality,
      status: "unresolved",
      internal_only: false,
      confidence: 0.6,
      decision_effect:
        materiality === "decision_critical"
          ? "Blocks high-certainty judgement until resolved"
          : undefined,
    };
    structured.push(gap);
  }

  const clientGaps = structured
    .filter(
      (g) =>
        !g.internal_only &&
        g.status === "unresolved" &&
        (g.materiality === "decision_critical" || g.materiality === "material") &&
        g.category === "evidence_gap"
    )
    .map((g) => g.missing_information);

  return { clientGaps, structured };
}

export function looksLikeScratchpadGap(text: string): boolean {
  return SCRATCHPAD_RE.test(text) || THEATRE_MISMATCH_RE.test(text);
}

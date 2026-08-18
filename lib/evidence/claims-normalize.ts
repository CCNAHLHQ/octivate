/**
 * Canonical evidence-claim layer — normalizes evidence_manager output and
 * deterministic multi-passage extraction (replaces slice(0,8) authority).
 */

import { findSupportingPassages } from "@/lib/evidence/citations";
import { uid } from "@/lib/store/json-store";
import type {
  CommonAgentOutput,
  EvidenceClaim,
  Project,
  SourceRecord,
} from "@/lib/types";
import type { EvidenceDocument } from "@/lib/evidence/types";

function nearDupKey(statement: string): string {
  return statement
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function pushUnique(claims: EvidenceClaim[], next: EvidenceClaim) {
  const key = nearDupKey(next.statement);
  if (!key) return;
  if (claims.some((c) => nearDupKey(c.statement) === key)) return;
  claims.push(next);
}

/** Convert evidence_manager material findings into atomic claims when present. */
export function claimsFromEvidenceManager(
  output: CommonAgentOutput | undefined | null,
  sourceRecords: SourceRecord[]
): EvidenceClaim[] {
  if (!output?.material_findings?.length) return [];
  const sourceIds = sourceRecords.map((s) => s.source_id);
  const claims: EvidenceClaim[] = [];
  for (const f of output.material_findings) {
    const statement = String(f.finding || f.decision_effect || "").trim();
    if (!statement) continue;
    const ids =
      Array.isArray(f.evidence_ids) && f.evidence_ids.length
        ? f.evidence_ids.filter((id) => sourceIds.includes(id) || id.startsWith("upload_") || id.startsWith("doc_"))
        : sourceIds.slice(0, 2);
    pushUnique(claims, {
      claim_id: f.finding_id || uid("claim"),
      statement,
      source_ids: ids.length ? ids : sourceIds.slice(0, 1),
      judgement_type: "fact",
      decision_relevance: f.decision_effect || "evidence_manager finding",
      confidence: f.confidence || "moderate",
      evidence_ids: Array.isArray(f.evidence_ids) ? f.evidence_ids : undefined,
      subject: undefined,
      predicate: undefined,
      objectValue: undefined,
    });
  }
  return claims;
}

/**
 * Deterministic multi-claim extraction across all materially relevant sources
 * (not capped at 8; up to 3 passages per source with local text).
 */
export function extractClaimsFromEvidence(
  sourceRecords: SourceRecord[],
  evidence: EvidenceDocument[],
  project: Project,
  question: string
): EvidenceClaim[] {
  const claims: EvidenceClaim[] = [];
  for (const s of sourceRecords) {
    const ev = evidence.find((e) => e.sourceId === s.source_id);
    if (ev?.text?.trim()) {
      const passages = findSupportingPassages(ev.text, question, {
        max: 3,
        windowChars: 280,
        title: s.title,
      });
      const windows =
        passages.length > 0
          ? passages
          : [
              {
                text: ev.text.replace(/\s+/g, " ").trim().slice(0, 220),
                score: 0.3,
              },
            ];
      for (const p of windows) {
        pushUnique(claims, {
          claim_id: uid("claim"),
          statement: p.text,
          source_ids: [s.source_id],
          judgement_type: "fact",
          decision_relevance: s.decision_relevance || `${project.sector} · ${project.country}`,
          confidence:
            passages.length && s.reliability === "high"
              ? "high"
              : passages.length
                ? "moderate"
                : "low",
          evidence_ids: [ev.id],
          eventDate: s.publication_date || undefined,
          observedAt: s.retrieved_at || undefined,
          component: undefined,
        });
      }
    } else if (s.decision_relevance?.trim()) {
      // Keep substantive registry relevance — not synthetic “Question-conditioned…” strings.
      if (/question-conditioned extract/i.test(s.decision_relevance)) continue;
      pushUnique(claims, {
        claim_id: uid("claim"),
        statement: `${s.title}: ${s.decision_relevance}`,
        source_ids: [s.source_id],
        judgement_type: "inference",
        decision_relevance: s.decision_relevance,
        confidence: "plausible_unverified",
      });
    }
  }
  return claims;
}

/** Merge manager claims + deterministic extraction; manager wins on near-dup. */
export function buildCanonicalClaims(opts: {
  evidenceManagerOutput?: CommonAgentOutput | null;
  sourceRecords: SourceRecord[];
  evidence: EvidenceDocument[];
  project: Project;
  question: string;
}): EvidenceClaim[] {
  const fromManager = claimsFromEvidenceManager(
    opts.evidenceManagerOutput,
    opts.sourceRecords
  );
  const fromEvidence = extractClaimsFromEvidence(
    opts.sourceRecords,
    opts.evidence,
    opts.project,
    opts.question
  );
  const out: EvidenceClaim[] = [];
  for (const c of fromManager) pushUnique(out, c);
  for (const c of fromEvidence) pushUnique(out, c);
  return out;
}

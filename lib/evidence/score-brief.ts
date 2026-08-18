import { labelCoverageScore } from "@/lib/evidence/labeler";
import {
  hasUnknownDecisionCriticalState,
} from "@/lib/evidence/current-state";
import type {
  BriefScoreBreakdown,
  EvidenceDocument,
  ScoringPolicy,
} from "@/lib/evidence/types";
import type {
  CommonAgentOutput,
  EvidenceClaim,
  ProjectStateFact,
  Source,
  SourceRecord,
} from "@/lib/types";

function confidenceToNumber(label: string): number {
  const map: Record<string, number> = {
    high: 85,
    moderate: 72,
    low: 58,
    plausible_unverified: 45,
    insufficient_evidence: 30,
  };
  return map[label] ?? 50;
}

function daysSince(iso?: string): number {
  if (!iso) return 999;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 999;
  return Math.max(0, (Date.now() - t) / 86_400_000);
}

/** Claim-level freshness — one recent source cannot freshen stale claims. */
function claimFreshness01(claims: EvidenceClaim[], evidence: EvidenceDocument[]): number {
  if (!claims.length) {
    const dates = evidence.map((e) => e.capturedAt || e.createdAt).filter(Boolean) as string[];
    if (!dates.length) return 0.35;
    const newest = Math.min(...dates.map((d) => daysSince(d)));
    if (newest <= 7) return 0.7;
    if (newest <= 30) return 0.55;
    return 0.35;
  }
  let sum = 0;
  for (const c of claims) {
    const d = c.eventDate || c.observedAt || c.deadlineAt;
    const age = daysSince(d);
    if (age <= 30) sum += 1;
    else if (age <= 90) sum += 0.6;
    else if (age <= 180) sum += 0.35;
    else sum += 0.2;
  }
  return sum / claims.length;
}

function provenance01(claims: EvidenceClaim[]): number {
  if (!claims.length) return 0.25;
  let ok = 0;
  for (const c of claims) {
    const hasSource = (c.source_ids || []).length > 0;
    const hasEvidence = (c.evidence_ids || []).length > 0;
    if (hasSource && hasEvidence) ok += 1;
    else if (hasSource) ok += 0.55;
    else ok += 0.2;
  }
  return ok / claims.length;
}

function corroboration01(claims: EvidenceClaim[]): number {
  if (!claims.length) return 0.3;
  const multi = claims.filter((c) => (c.source_ids || []).length >= 2).length;
  // Independent corroboration — not agent lens count.
  return Math.min(1, 0.35 + multi / Math.max(1, claims.length));
}

function sourceScore01(records: SourceRecord[], catalog: Source[]): number {
  if (!records.length) return 0.3;
  const byId = new Map(catalog.map((s) => [s.id, s]));
  let sum = 0;
  let n = 0;
  for (const r of records) {
    const s = byId.get(r.source_id);
    if (s?.totalSourceScore != null) {
      sum += Math.min(1, s.totalSourceScore / 100);
      n += 1;
    } else if (r.reliability === "high") {
      sum += 0.8;
      n += 1;
    } else if (r.reliability === "moderate") {
      sum += 0.55;
      n += 1;
    } else {
      sum += 0.35;
      n += 1;
    }
  }
  return n ? sum / n : 0.3;
}

export function scoreBriefConfidence(opts: {
  policy: ScoringPolicy;
  agentOutputs: CommonAgentOutput[];
  sourceRecords: SourceRecord[];
  catalog: Source[];
  evidence: EvidenceDocument[];
  claims?: EvidenceClaim[];
  currentState?: ProjectStateFact[];
}): BriefScoreBreakdown {
  const { policy } = opts;
  const claims = opts.claims || [];
  const weightSum =
    policy.sourceScoreW +
    policy.labelMatchW +
    policy.agentConfW +
    policy.triangulationW +
    policy.freshnessW || 100;

  const confidences = opts.agentOutputs.map((o) => o.overall_confidence).filter(Boolean);
  const agent01 = confidences.length
    ? confidences.reduce((a, c) => a + confidenceToNumber(c), 0) /
      confidences.length /
      100
    : 0.5;

  const label01 = opts.evidence.length
    ? opts.evidence.reduce((a, e) => a + labelCoverageScore(e.labels), 0) /
      opts.evidence.length
    : 0.25;

  const source01 = sourceScore01(opts.sourceRecords, opts.catalog);
  const fresh01 = claimFreshness01(claims, opts.evidence);
  const prov01 = provenance01(claims);
  const corr01 = corroboration01(claims);
  // Triangulation weight now = independent corroboration among claims, not lens count.
  const tri01 = corr01;

  const parts = {
    sourceScore: Math.round((source01 * policy.sourceScoreW * 100) / weightSum),
    labelMatch: Math.round((label01 * policy.labelMatchW * 100) / weightSum),
    agentConf: Math.round((agent01 * policy.agentConfW * 100) / weightSum),
    triangulation: Math.round((tri01 * policy.triangulationW * 100) / weightSum),
    freshness: Math.round((fresh01 * policy.freshnessW * 100) / weightSum),
    provenance: Math.round(prov01 * 100),
    currentState: hasUnknownDecisionCriticalState(opts.currentState || []) ? 20 : 80,
  };

  let total = Math.max(
    0,
    Math.min(
      100,
      parts.sourceScore +
        parts.labelMatch +
        parts.agentConf +
        parts.triangulation +
        parts.freshness
    )
  );

  let hardCapped = false;
  if (hasUnknownDecisionCriticalState(opts.currentState || [])) {
    total = Math.min(total, 58);
    hardCapped = true;
  }
  if ((opts.agentOutputs || []).some((o) =>
    (o.review_flags || []).some((f) => /schema_validation_failure|hard_schema/i.test(f))
  )) {
    total = Math.min(total, 55);
    hardCapped = true;
  }

  return { total, parts, policy, hardCapped };
}

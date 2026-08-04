import { labelCoverageScore } from "@/lib/evidence/labeler";
import type {
  BriefScoreBreakdown,
  EvidenceDocument,
  ScoringPolicy,
} from "@/lib/evidence/types";
import type { CommonAgentOutput, Source, SourceRecord } from "@/lib/types";

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

function freshness01(sources: Source[], evidence: EvidenceDocument[]): number {
  const dates = [
    ...sources.map((s) => s.lastCaptureAt || s.healthCheckedAt || s.lastChecked),
    ...evidence.map((e) => e.capturedAt || e.createdAt),
  ].filter(Boolean) as string[];
  if (!dates.length) return 0.35;
  const newest = Math.min(...dates.map((d) => daysSince(d)));
  if (newest <= 7) return 1;
  if (newest <= 30) return 0.75;
  if (newest <= 90) return 0.5;
  return 0.25;
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
}): BriefScoreBreakdown {
  const { policy } = opts;
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
  const fresh01 = freshness01(opts.catalog, opts.evidence);

  const lensStatuses = opts.agentOutputs.filter((o) =>
    ["power_analyst", "systems_analyst", "narrative_analyst"].includes(String(o.agent || ""))
  );
  const lenses = lensStatuses.length >= 3 ? lensStatuses : opts.agentOutputs.slice(0, 3);
  const usable = lenses.filter((o) => o.output_status !== "insufficient_evidence").length;
  const tri01 = Math.min(1, usable / 3);

  const parts = {
    sourceScore: Math.round((source01 * policy.sourceScoreW * 100) / weightSum),
    labelMatch: Math.round((label01 * policy.labelMatchW * 100) / weightSum),
    agentConf: Math.round((agent01 * policy.agentConfW * 100) / weightSum),
    triangulation: Math.round((tri01 * policy.triangulationW * 100) / weightSum),
    freshness: Math.round((fresh01 * policy.freshnessW * 100) / weightSum),
  };

  const total = Math.max(
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

  return { total, parts, policy };
}

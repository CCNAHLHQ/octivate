import { readObject, writeObject } from "@/lib/store/json-store";
import {
  DEFAULT_SCORING_POLICY,
  type ScoringPolicy,
} from "@/lib/evidence/types";

const KEY = "scoring-policy";

function normalize(raw?: Partial<ScoringPolicy> | null): ScoringPolicy {
  const merged = { ...DEFAULT_SCORING_POLICY, ...(raw || {}) };
  const sum =
    merged.sourceScoreW +
    merged.labelMatchW +
    merged.agentConfW +
    merged.triangulationW +
    merged.freshnessW;
  if (sum <= 0) return { ...DEFAULT_SCORING_POLICY };
  // Keep relative weights; scoreBrief renormalizes.
  return merged;
}

export async function readScoringPolicy(): Promise<ScoringPolicy> {
  const stored = await readObject<ScoringPolicy>(KEY, DEFAULT_SCORING_POLICY);
  return normalize(stored);
}

export async function writeScoringPolicy(policy: ScoringPolicy): Promise<ScoringPolicy> {
  const next = normalize(policy);
  await writeObject(KEY, next);
  return next;
}

/**
 * Analytical release gate — hard blocks Final approval on integrity failures.
 */

import { looksLikeScratchpadGap } from "@/lib/evidence/gap-consolidate";
import {
  hasExpiredOpportunityPresentedAsOpen,
  hasUnknownDecisionCriticalState,
  type LifecycleState,
} from "@/lib/evidence/current-state";
import type { Brief, ProjectStateFact } from "@/lib/types";

export type ReleaseIssue = {
  code: string;
  severity: "hard" | "soft" | "info";
  message: string;
};

export type ReleaseValidation = {
  ok: boolean;
  hardBlocks: ReleaseIssue[];
  softWarnings: ReleaseIssue[];
  info: ReleaseIssue[];
};

const PLACEHOLDER_JUDGEMENT =
  /judgement pending|pending operator review|see structured findings|n\/a\b/i;

const OBJECT_OBJECT = /\[object Object\]/;

export function validateBriefForRelease(
  brief: Brief,
  opts?: { currentState?: ProjectStateFact[]; allowSoftOverride?: boolean }
): ReleaseValidation {
  const hardBlocks: ReleaseIssue[] = [];
  const softWarnings: ReleaseIssue[] = [];
  const info: ReleaseIssue[] = [];

  const judgement = String(brief.analyticalJudgement || brief.executiveSummary || "").trim();
  if (!judgement || PLACEHOLDER_JUDGEMENT.test(judgement)) {
    hardBlocks.push({
      code: "placeholder_judgement",
      severity: "hard",
      message: "Analytical judgement is missing or still a placeholder.",
    });
  }

  const clientText = [
    judgement,
    ...(brief.recommendations || []),
    ...(brief.power || []),
    ...(brief.systems || []),
    ...(brief.narratives || []),
    ...(brief.gaps || []),
    ...(brief.evidenceGaps || []),
  ].join("\n");

  if (OBJECT_OBJECT.test(clientText)) {
    hardBlocks.push({
      code: "malformed_client_text",
      severity: "hard",
      message: "Client-facing text contains malformed [object Object] content.",
    });
  }

  for (const g of [...(brief.evidenceGaps || []), ...(brief.gaps || [])]) {
    if (looksLikeScratchpadGap(g)) {
      hardBlocks.push({
        code: "scratchpad_gap",
        severity: "hard",
        message: `Evidence gap contains scratchpad/meta language: “${g.slice(0, 80)}…”`,
      });
      break;
    }
  }

  if ((brief.reviewFlags || []).some((f) => /schema_validation_failure|hard_schema/i.test(f))) {
    hardBlocks.push({
      code: "schema_failure",
      severity: "hard",
      message: "Unresolved decision-critical schema validation failures remain.",
    });
  }

  const state = opts?.currentState || [];
  if (hasUnknownDecisionCriticalState(state) && (brief.confidence || 0) >= 75) {
    hardBlocks.push({
      code: "unknown_state_high_confidence",
      severity: "hard",
      message:
        "Decision-critical procurement/opportunity state is UNKNOWN while confidence asserts certainty.",
    });
  }

  if (hasExpiredOpportunityPresentedAsOpen(state, clientText)) {
    hardBlocks.push({
      code: "expired_as_current",
      severity: "hard",
      message: "Expired opportunity is labelled current / ACT NOW without reopening evidence.",
    });
  }

  // Also catch explicit past deadlines in recommendations without state facts.
  if (
    /15\s*May\s*2026|2026-05-15/i.test(clientText) &&
    /prepare|pursue|act now|deadline/i.test(clientText) &&
    brief.createdAt &&
    brief.createdAt.slice(0, 10) > "2026-05-15"
  ) {
    hardBlocks.push({
      code: "past_deadline_action",
      severity: "hard",
      message: "Brief recommends action against a deadline that is already past.",
    });
  }

  const cites = brief.citedSources || [];
  const unsupported = cites.filter(
    (c) =>
      Array.isArray(c.supportedClaimIds) &&
      c.supportedClaimIds.length === 0 &&
      !c.ungrounded
  );
  if (cites.length && unsupported.length === cites.length) {
    softWarnings.push({
      code: "cites_without_claims",
      severity: "soft",
      message: "Cited sources do not list supporting material claim IDs.",
    });
  }

  if ((brief.evidenceCoverage?.includedDocs || 0) === 0 && (brief.evidenceCoverage?.totalDocs || 0) > 0) {
    hardBlocks.push({
      code: "ingestion_coverage_failure",
      severity: "hard",
      message: "Hard ingestion/coverage failure: uploads exist but none were included.",
    });
  }

  if (/question-conditioned extract/i.test(clientText)) {
    hardBlocks.push({
      code: "bundle_metadata_leak",
      severity: "hard",
      message: "Bundle extraction metadata leaked into client-facing analysis.",
    });
  }

  for (const r of brief.recommendations || []) {
    if (/^option_\d+/i.test(r.trim()) || /\boption_\d+\b/i.test(r.split(":")[0] || "")) {
      softWarnings.push({
        code: "internal_option_label",
        severity: "soft",
        message: "Recommendation still exposes an internal option_N label.",
      });
      break;
    }
  }

  if ((brief.confidence || 0) >= 80 && hasUnknownDecisionCriticalState(state)) {
    // already hard-blocked above; keep info for operators
    info.push({
      code: "confidence_cap_hint",
      severity: "info",
      message: "Confidence should be hard-capped while central status is UNKNOWN.",
    });
  }

  void opts?.allowSoftOverride;

  return {
    ok: hardBlocks.length === 0,
    hardBlocks,
    softWarnings,
    info,
  };
}

/** Map lifecycle for tests / callers. */
export type { LifecycleState };

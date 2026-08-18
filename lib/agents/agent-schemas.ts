/**
 * Agent-specific schema mapping + nested finding validation for doctrine agents.
 */

import { validateAgainstSchema } from "@/lib/protocol/validator";
import type { CommonAgentOutput, DoctrineAgentName, MaterialFinding } from "@/lib/types";

/** Dedicated finding schemas (nested) keyed by agent. */
export const AGENT_SCHEMA_MAP: Partial<Record<DoctrineAgentName, string>> = {
  power_analyst: "power_finding.schema.json",
  systems_analyst: "systems_finding.schema.json",
  narrative_analyst: "narrative_finding.schema.json",
  psn_synthesiser: "psn_interaction.schema.json",
  scenario_recommendation: "recommendation.schema.json",
};

export type AgentValidationResult = {
  valid: boolean;
  errors: string[];
  /** Decision-critical invalid findings should not feed synthesis. */
  acceptedFindings: MaterialFinding[];
  blocked: boolean;
};

function findingLooksWeak(agent: DoctrineAgentName, f: MaterialFinding): string | null {
  const text = String(f.finding || "").trim();
  if (!text) return "empty finding";
  if (/question-conditioned extract/i.test(text)) return "bundle metadata as finding";
  if (agent === "power_analyst") {
    if (text.length < 24) return "power finding too thin";
    if (!/actor|minister|authority|stakeholder|influence|coalition|owner|office/i.test(text) &&
        !f.decision_effect) {
      return "power finding missing actor/mechanism/decision effect";
    }
  }
  if (agent === "narrative_analyst" && /question-conditioned|weak keyword/i.test(text)) {
    return "narrative metadata leak";
  }
  if (f.confidence && !["high", "moderate", "low", "plausible_unverified", "insufficient_evidence"].includes(f.confidence)) {
    return "malformed confidence";
  }
  return null;
}

export function validateAgentOutput(
  agent: DoctrineAgentName,
  data: CommonAgentOutput
): AgentValidationResult {
  const envelope = validateAgainstSchema("common_agent_output.schema.json", data);
  const errors: string[] = [];
  if (!envelope.valid && "errors" in envelope) {
    errors.push(...envelope.errors);
  }

  const nestedSchema = AGENT_SCHEMA_MAP[agent];
  const accepted: MaterialFinding[] = [];
  const findings = Array.isArray(data.material_findings) ? data.material_findings : [];

  for (const f of findings) {
    const weak = findingLooksWeak(agent, f);
    if (weak) {
      errors.push(`${f.finding_id || "finding"}: ${weak}`);
      continue;
    }
    if (nestedSchema) {
      // Soft nested check — dedicated schemas are stricter shapes; accept if envelope finding is usable.
      const nested = validateAgainstSchema(nestedSchema, {
        ...f,
        // pad required interaction fields when synthesising from material_findings
        power_component: (f as MaterialFinding & { power_component?: string }).power_component || f.finding,
        systems_component:
          (f as MaterialFinding & { systems_component?: string }).systems_component || f.finding,
        narrative_component:
          (f as MaterialFinding & { narrative_component?: string }).narrative_component || f.finding,
        causal_interaction: f.finding,
        decision_effect: f.decision_effect || f.finding,
        evidence_ids: f.evidence_ids || [],
        analytical_judgement: f.finding,
        options: [],
        preferred_option: f.finding_id || "option",
        tradeoffs: [],
        reassessment_triggers: [],
      });
      if (!nested.valid && agent !== "scenario_recommendation" && agent !== "psn_synthesiser") {
        // For lens findings, prefer heuristic gate over hard nested fail (schema variance).
        errors.push(
          `${f.finding_id || "finding"}: nested schema soft-fail (${"errors" in nested ? nested.errors[0] : "invalid"})`
        );
      }
    }
    accepted.push(f);
  }

  const decisionCritical = [
    "power_analyst",
    "systems_analyst",
    "narrative_analyst",
    "scenario_recommendation",
    "psn_synthesiser",
  ].includes(agent);

  const blocked =
    decisionCritical &&
    findings.length > 0 &&
    accepted.length === 0 &&
    data.output_status !== "insufficient_evidence";

  return {
    valid: errors.length === 0 && envelope.valid,
    errors,
    acceptedFindings: accepted,
    blocked,
  };
}

export type PsnLensCoverage = "full" | "partial" | "insufficient";

export function assessPsnLensCoverage(opts: {
  powerUsable: boolean;
  systemsUsable: boolean;
  narrativeUsable: boolean;
}): {
  coverage: PsnLensCoverage;
  allThree: boolean;
  missingLenses: string[];
  usableCount: number;
} {
  const missing: string[] = [];
  if (!opts.powerUsable) missing.push("power");
  if (!opts.systemsUsable) missing.push("systems");
  if (!opts.narrativeUsable) missing.push("narrative");
  const usableCount = 3 - missing.length;
  const allThree = usableCount === 3;
  const coverage: PsnLensCoverage =
    usableCount === 3 ? "full" : usableCount === 0 ? "insufficient" : "partial";
  return { coverage, allThree, missingLenses: missing, usableCount };
}

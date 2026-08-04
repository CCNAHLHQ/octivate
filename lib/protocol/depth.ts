import fs from "fs";
import path from "path";
import yaml from "yaml";
import type { AnalysisDepth } from "@/lib/types";
import { CONFIG_DIR } from "./paths";

export interface DepthCaps {
  max_findings_per_lens: number;
  max_psn_interactions: number;
  max_scenarios: number;
  max_options: number;
}

interface DepthConfig {
  analysis_depths: Record<AnalysisDepth, DepthCaps>;
  exceeding_limits: { allowed: boolean; requires: string[] };
}

let cached: DepthConfig | null = null;

function loadDepthConfig(): DepthConfig {
  if (cached) return cached;
  const raw = fs.readFileSync(path.join(CONFIG_DIR, "analysis_depth.yaml"), "utf8");
  cached = yaml.parse(raw) as DepthConfig;
  return cached;
}

export function getDepthCaps(depth: AnalysisDepth): DepthCaps {
  const config = loadDepthConfig();
  return config.analysis_depths[depth] ?? config.analysis_depths.standard;
}

/** Relative completion budget vs operator doctrineMaxTokens baseline. */
export function depthTokenMultiplier(depth: AnalysisDepth): number {
  if (depth === "rapid") return 0.7;
  if (depth === "deep_dive") return 1.35;
  return 1;
}

export function depthDisclaimer(depth: AnalysisDepth): string {
  if (depth === "rapid") {
    return "Rapid scan — narrow findings for orientation only; verify before acting.";
  }
  if (depth === "deep_dive") {
    return "Deep dive draft — broader scenarios and options; still requires human review before action.";
  }
  return "Standard draft — balanced PSN analysis pending human review.";
}

export function depthPromptSuffix(depth: AnalysisDepth): string {
  const caps = getDepthCaps(depth);
  const lines = [
    `Analysis depth: ${depth}.`,
    `Max findings per lens: ${caps.max_findings_per_lens}.`,
    `Max PSN interactions: ${caps.max_psn_interactions}.`,
    `Max scenarios: ${caps.max_scenarios}.`,
    `Max options: ${caps.max_options}.`,
    "Report only material findings supported by evidence IDs from the provided sources.",
    "Do not invent sources, actors, or statistics. Prefer fewer high-quality findings over padded lists.",
    "Keep analysis distinct from recommendations unless you are the scenario/recommendation agent.",
    "Every material finding must state a concrete decision effect for this question scoped to the project country and sector.",
    "If the corpus does not speak to this theatre, say so via insufficient_evidence rather than stretching analogies.",
  ];

  if (depth === "rapid") {
    lines.push(
      "Rapid mode: stay tightly scoped to the decision question.",
      "Prefer the single most consequential PSN interaction.",
      "Keep the executive judgement short (3–5 sentences max when synthesising).",
      "Do not explore side themes unless they block the decision."
    );
  } else if (depth === "deep_dive") {
    lines.push(
      "Deep-dive mode: explore competing explanations and failure transmission where material.",
      "Still stay decision-relevant — breadth without decision effect is noise.",
      "Surface evidence gaps explicitly rather than filling them with speculation."
    );
  } else {
    lines.push(
      "Standard mode: balanced coverage across Power, Systems, and Narratives.",
      "One or two consequential interactions are enough when evidence is thin."
    );
  }

  return lines.join(" ");
}

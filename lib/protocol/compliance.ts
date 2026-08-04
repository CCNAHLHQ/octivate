import fs from "fs";
import path from "path";
import yaml from "yaml";
import type { AgentSession, CommonAgentOutput } from "@/lib/types";
import { PROTOCOL_ROOT } from "./paths";

export interface ComplianceCheck {
  id: string;
  description: string;
  passed: boolean;
  detail?: string;
}

interface ComplianceConfig {
  checks: { id: string; description: string; severity: string }[];
}

let cached: ComplianceConfig | null = null;

function loadChecks(): ComplianceConfig {
  if (cached) return cached;
  const raw = fs.readFileSync(
    path.join(PROTOCOL_ROOT, "evaluation", "doctrine_compliance_checks.yaml"),
    "utf8"
  );
  cached = yaml.parse(raw) as ComplianceConfig;
  return cached;
}

function evaluateCheck(id: string, session: AgentSession, outputs: CommonAgentOutput[]): boolean {
  switch (id) {
    case "CHECK-CORE-01":
      return outputs.every(
        (o) =>
          o.agent &&
          o.decision_id &&
          o.output_status &&
          Array.isArray(o.material_findings)
      );
    case "CHECK-EVIDENCE-01":
      return outputs.every((o) => {
        if (o.output_status === "insufficient_evidence") return true;
        return (o.material_findings || []).every(
          (f) => f.evidence_ids && f.evidence_ids.length > 0
        );
      });
    case "CHECK-MATERIALITY-01":
      return outputs.every((o) =>
        (o.material_findings || []).every(
          (f) => f.decision_effect && f.decision_effect.length >= 5
        )
      );
    case "CHECK-HUMAN-01":
      return session.pipelineMode === "mock" || session.status !== "completed" || Boolean(session.briefId);
    default:
      return outputs.length > 0;
  }
}

export function runComplianceChecks(session: AgentSession): ComplianceCheck[] {
  const config = loadChecks();
  const outputs = (session.agentOutputs || []) as CommonAgentOutput[];

  return config.checks.map((check) => ({
    id: check.id,
    description: check.description,
    passed: evaluateCheck(check.id, session, outputs),
  }));
}

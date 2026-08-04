import fs from "fs";
import path from "path";
import yaml from "yaml";
import { CONFIG_DIR } from "./paths";

export interface WorkflowGate {
  required?: string[];
  requires_one_of?: string[];
}

export interface WorkflowConfig {
  states: string[];
  gates: Record<string, WorkflowGate>;
}

let cached: WorkflowConfig | null = null;

export function loadWorkflow(): WorkflowConfig {
  if (cached) return cached;
  const raw = fs.readFileSync(path.join(CONFIG_DIR, "workflow.yaml"), "utf8");
  cached = yaml.parse(raw) as WorkflowConfig;
  return cached;
}

export function checkGate(
  gateName: string,
  context: Record<string, unknown>
): { ok: true } | { ok: false; missing: string[] } {
  const workflow = loadWorkflow();
  const gate = workflow.gates[gateName];
  if (!gate) return { ok: true };

  const missing: string[] = [];

  if (gate.required) {
    for (const key of gate.required) {
      if (!context[key]) missing.push(key);
    }
  }

  if (gate.requires_one_of) {
    const any = gate.requires_one_of.some((key) => Boolean(context[key]));
    if (!any) missing.push(...gate.requires_one_of);
  }

  if (missing.length) return { ok: false, missing };
  return { ok: true };
}

import type { AgentName } from "@/lib/types";

/** Legacy stage labels kept for UI compatibility; doctrine uses DoctrineAgentName. */
export const AGENT_DEFS: { name: AgentName; label: string }[] = [
  { name: "intake", label: "Decision Intake" },
  { name: "planning", label: "Planning" },
  { name: "retrieval", label: "Retrieval" },
  { name: "validation", label: "Validation" },
  { name: "analysis", label: "Analysis (PSN)" },
  { name: "decision", label: "Decision" },
  { name: "monitoring", label: "Monitoring" },
  { name: "learning", label: "Learning" },
];

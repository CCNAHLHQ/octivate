export const MODERATION_COLLECTIONS = [
  "projects",
  "briefs",
  "monitors",
  "mailing-list",
  "agent-sessions",
  "costs",
  "audit",
  "support-threads",
] as const;

export type ModerationCollection = (typeof MODERATION_COLLECTIONS)[number];

export const MODERATION_LABELS: Record<ModerationCollection, string> = {
  projects: "Projects",
  briefs: "Briefs",
  monitors: "Monitors",
  "mailing-list": "Mailing list",
  "agent-sessions": "Agent sessions",
  costs: "Cost ledger",
  audit: "Audit trail",
  "support-threads": "Support",
};

export const MODERATION_READ_ONLY: ModerationCollection[] = ["audit"];

export function isModerationCollection(value: string): value is ModerationCollection {
  return (MODERATION_COLLECTIONS as readonly string[]).includes(value);
}

export function isModerationReadOnly(collection: ModerationCollection): boolean {
  return MODERATION_READ_ONLY.includes(collection);
}

export type ModerationRow = {
  id: string;
  collection: ModerationCollection;
  title: string;
  meta: string;
  createdAt?: string;
  flagged?: boolean;
  hidden?: boolean;
  href?: string;
  detail?: string;
};

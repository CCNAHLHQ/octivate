import type { OperatorLayoutModule } from "@/lib/hooks/use-operator-layout";

export const PULSE_LAYOUT: OperatorLayoutModule[] = [
  { id: "kpis", slot: "left", order: 0 },
  { id: "sessions", slot: "left", order: 1 },
  { id: "cost", slot: "left", order: 2 },
  { id: "reviews", slot: "right", order: 0 },
  { id: "capacity", slot: "right", order: 1 },
  { id: "runtime", slot: "right", order: 2 },
];

export const CONTROL_LAYOUT: OperatorLayoutModule[] = [
  { id: "limits", slot: "left", order: 0 },
  { id: "models", slot: "left", order: 1 },
  { id: "evidence", slot: "left", order: 2 },
  { id: "capacity", slot: "right", order: 0 },
  { id: "runtime", slot: "right", order: 1 },
];

export const OPERATIONS_LAYOUT: OperatorLayoutModule[] = [
  { id: "ledger", slot: "left", order: 0 },
  { id: "sessions", slot: "left", order: 1 },
  { id: "moderation", slot: "right", order: 0 },
];

export const CATALOG_LAYOUT: OperatorLayoutModule[] = [
  { id: "ticker", slot: "left", order: 0 },
  { id: "autocheck", slot: "right", order: 0 },
  { id: "capture", slot: "right", order: 1 },
  { id: "sources", slot: "right", order: 2 },
];

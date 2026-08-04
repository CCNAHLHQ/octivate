"use client";

import type { OperatorTab } from "@/components/operator/operator-types";
import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";

const MAIN_TABS: { id: OperatorTab; label: string; hint: string }[] = [
  { id: "pulse", label: "Pulse", hint: "Platform health and live activity" },
  { id: "operations", label: "Operations", hint: "Cost ledger and operational actions" },
  { id: "control", label: "Control", hint: "Limits, models, and platform controls" },
  { id: "catalog", label: "Catalog", hint: "Source registry and catalog tools" },
  {
    id: "support",
    label: "Customer Support",
    hint: "Account-based support inbox and moderation",
  },
  { id: "mail", label: "Mail", hint: "Operator outbound mail and mailing list" },
  { id: "users", label: "Users", hint: "Member accounts and access" },
  { id: "pricing", label: "Pricing", hint: "Plan and pricing configuration" },
  { id: "exports", label: "Exports", hint: "Export jobs and artifacts" },
  { id: "debug", label: "Debug", hint: "Ops event stream and diagnostics" },
];

export function OperatorMainTabs({
  active,
  onChange,
  counts,
}: {
  active: OperatorTab;
  onChange: (tab: OperatorTab) => void;
  counts?: Partial<Record<OperatorTab, number>>;
}) {
  const filters = MAIN_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    count: counts?.[t.id],
    tourId: `op-tab-${t.id}`,
    title: t.hint,
  }));

  return (
    <div className="op-main-tabs">
      <WorkspaceToolbar
        search=""
        onSearchChange={() => {}}
        showSearch={false}
        filters={filters}
        activeFilter={active}
        onFilterChange={(id) => onChange(id as OperatorTab)}
        className="op-main-tabs-toolbar"
      />
    </div>
  );
}

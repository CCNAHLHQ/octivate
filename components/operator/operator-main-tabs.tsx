"use client";

import type { OperatorTab } from "@/components/operator/operator-types";
import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import { useT } from "@/components/i18n/locale-provider";

const MAIN_TABS: { id: OperatorTab; labelKey: string; hintKey: string }[] = [
  { id: "pulse", labelKey: "op.tab.pulse", hintKey: "op.tab.pulse.hint" },
  { id: "operations", labelKey: "op.tab.operations", hintKey: "op.tab.operations.hint" },
  { id: "control", labelKey: "op.tab.control", hintKey: "op.tab.control.hint" },
  { id: "catalog", labelKey: "op.tab.catalog", hintKey: "op.tab.catalog.hint" },
  { id: "support", labelKey: "op.tab.support", hintKey: "op.tab.support.hint" },
  { id: "mail", labelKey: "op.tab.mail", hintKey: "op.tab.mail.hint" },
  { id: "users", labelKey: "op.tab.users", hintKey: "op.tab.users.hint" },
  { id: "pricing", labelKey: "op.tab.pricing", hintKey: "op.tab.pricing.hint" },
  { id: "automation", labelKey: "op.tab.automation", hintKey: "op.tab.automation.hint" },
  { id: "exports", labelKey: "op.tab.exports", hintKey: "op.tab.exports.hint" },
  { id: "debug", labelKey: "op.tab.debug", hintKey: "op.tab.debug.hint" },
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
  const t = useT();
  const filters = MAIN_TABS.map((tab) => ({
    id: tab.id,
    label: t(tab.labelKey),
    count: counts?.[tab.id],
    tourId: `op-tab-${tab.id}`,
    title: t(tab.hintKey),
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

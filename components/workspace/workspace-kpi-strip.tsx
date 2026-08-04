import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type WorkspaceKpi = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "teal" | "amber" | "violet";
  href?: string;
  tooltip?: string;
};

function KpiCard({ item }: { item: WorkspaceKpi }) {
  const Icon = item.icon;
  const className = cn(
    "ws-kpi-card",
    item.tone && item.tone !== "default" && `is-${item.tone}`,
    item.href && "is-clickable"
  );

  const body = (
    <>
      <div className="ws-kpi-top">
        {Icon ? (
          <span className="ws-kpi-ico" aria-hidden>
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
        <span className="ws-kpi-label">{item.label}</span>
      </div>
      <div className="ws-kpi-value">{item.value}</div>
      <div className="ws-kpi-hint">{item.hint || "\u00a0"}</div>
    </>
  );

  if (item.href) {
    return (
      <Link href={item.href} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}

export function WorkspaceKpiStrip({
  items,
  columns,
}: {
  items: WorkspaceKpi[];
  /** Prefer an explicit column count for known layouts (e.g. operator Live KPIs = 3). */
  columns?: 2 | 3 | 4 | 6;
}) {
  const colClass =
    columns === 2
      ? "is-cols-2"
      : columns === 3
        ? "is-cols-3"
        : columns === 4
          ? "is-cols-4"
          : columns === 6
            ? "is-cols-6"
            : items.length === 6
              ? "is-cols-3"
              : undefined;

  return (
    <div className={cn("ws-kpi-strip", colClass)} style={{ ["--ws-kpi-count" as string]: items.length }}>
      {items.map((item) => {
        const card = <KpiCard item={item} />;
        if (!item.tooltip) {
          return (
            <div key={item.label} className="ws-kpi-cell">
              {card}
            </div>
          );
        }
        return (
          <Tooltip key={item.label} content={item.tooltip} side="top" className="ws-kpi-cell" wrap>
            {card}
          </Tooltip>
        );
      })}
    </div>
  );
}

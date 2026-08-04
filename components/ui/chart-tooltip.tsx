"use client";

import { CHART } from "@/components/ui/chart-theme";

type PayloadItem = {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: PayloadItem[];
  label?: string;
  formatter?: (value: number | string, name: string, item: PayloadItem) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      {label && <div className="chart-tooltip-title">{label}</div>}
      <ul className="chart-tooltip-list">
        {payload.map((entry, i) => {
          const raw = entry.value ?? 0;
          const rowLabel =
            (typeof entry.payload?.label === "string" && entry.payload.label) ||
            label ||
            String(entry.name ?? "");
          const display = formatter
            ? formatter(raw, String(entry.name ?? ""), entry)
            : String(raw);
          return (
            <li key={i} className="chart-tooltip-row">
              <span
                className="chart-tooltip-dot"
                style={{ background: entry.color || CHART.palette[i % CHART.palette.length] }}
              />
              <span className="chart-tooltip-name">{rowLabel}</span>
              <span className="chart-tooltip-value">{display}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

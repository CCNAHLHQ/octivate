"use client";

import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
} from "recharts";
import { useMounted } from "@/lib/use-mounted";
import { Skeleton } from "@/components/ui/progress";
import { CHART, DEFAULT_CHART_HEIGHT, TALL_CHART_HEIGHT, chartCss } from "@/components/ui/chart-theme";
import { ChartTooltipContent } from "@/components/ui/chart-tooltip";
import { useId } from "react";

function ChartShell({
  children,
  className = DEFAULT_CHART_HEIGHT,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const mounted = useMounted();
  if (!mounted) {
    return <Skeleton className={`w-full rounded-[var(--r-md)] ${className}`} />;
  }
  return <>{children}</>;
}

function ChartLegend({
  items,
}: {
  items: { name: string; value: number; color: string }[];
}) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span key={item.name} className="chart-legend-item">
          <span className="chart-legend-dot" style={{ background: item.color }} />
          <span>{item.name}</span>
          <span className="chart-legend-value">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

export function ConfidenceGauge({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const gradId = useId().replace(/:/g, "");
  const fillUrl = `url(#gaugeGradient-${gradId})`;
  const data = [{ name: "confidence", value: clamped, fill: fillUrl }];
  const theme = chartCss();

  return (
    <ChartShell className={DEFAULT_CHART_HEIGHT}>
      <div className={`chart-panel relative w-full ${DEFAULT_CHART_HEIGHT}`}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="72%"
            innerRadius="68%"
            outerRadius="102%"
            startAngle={180}
            endAngle={0}
            data={data}
            barSize={14}
          >
            <defs>
              <linearGradient id={`gaugeGradient-${gradId}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7C3AED" />
                <stop offset="100%" stopColor="#A855F7" />
              </linearGradient>
            </defs>
            <RadialBar
              dataKey="value"
              cornerRadius={8}
              background={{ fill: theme.track }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="chart-gauge-center">
          <div className="chart-gauge-value">{clamped.toFixed(0)}%</div>
          <div className="chart-center-label">Confidence</div>
        </div>
      </div>
    </ChartShell>
  );
}

export function DonutChart({
  segments,
  centerLabel,
  showLegend = true,
}: {
  segments: { name: string; value: number }[];
  centerLabel?: string;
  showLegend?: boolean;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const legendItems = segments.map((s, i) => ({
    name: s.name,
    value: s.value,
    color: CHART.palette[i % CHART.palette.length],
  }));

  return (
    <ChartShell className={showLegend ? "min-h-[15.5rem]" : DEFAULT_CHART_HEIGHT}>
      <div className="chart-panel w-full">
        <div className={`relative w-full ${DEFAULT_CHART_HEIGHT}`}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={segments}
                dataKey="value"
                nameKey="name"
                innerRadius="58%"
                outerRadius="82%"
                paddingAngle={3}
                stroke="none"
                animationDuration={600}
              >
                {segments.map((_, i) => (
                  <Cell
                    key={i}
                    fill={CHART.palette[i % CHART.palette.length]}
                    stroke="rgba(7, 11, 23, 0.6)"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(v, name) => `${v}${total ? ` (${Math.round((Number(v) / total) * 100)}%)` : ""}`}
                  />
                }
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="chart-center">
            <div className="chart-center-value">{total}</div>
            {centerLabel && <div className="chart-center-label">{centerLabel}</div>}
          </div>
        </div>
        {showLegend && <ChartLegend items={legendItems} />}
      </div>
    </ChartShell>
  );
}

export function HorizontalRiskBars({
  items,
}: {
  items: { label: string; value: number; color?: string }[];
}) {
  const theme = chartCss();
  const data = items.map((i, idx) => ({
    ...i,
    color: i.color || CHART.palette[idx % CHART.palette.length],
  }));
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ChartShell className={TALL_CHART_HEIGHT}>
      <div className={`chart-panel w-full ${TALL_CHART_HEIGHT}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 4, right: 36, top: 8, bottom: 8 }}
            barCategoryGap="28%"
          >
            <XAxis type="number" hide domain={[0, max * 1.15]} />
            <YAxis
              type="category"
              dataKey="label"
              width={84}
              tick={CHART.tick}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: CHART.cursor }}
              content={
                <ChartTooltipContent formatter={(v) => `${v}%`} />
              }
            />
            <Bar
              dataKey="value"
              radius={[0, 6, 6, 0]}
              barSize={18}
              background={{ fill: theme.track, radius: 6 }}
              activeBar={{ opacity: 0.85 }}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                fill={theme.label}
                fontSize={12}
                fontWeight={700}
                fontFamily="var(--font-mono)"
                formatter={(v: number) => `${v}%`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}

export function DistBars({
  items,
  heightClass = TALL_CHART_HEIGHT,
  valueLabel = "count",
}: {
  items: { label: string; value: number; color?: string; detail?: string }[];
  heightClass?: string;
  /** Noun used in tooltips, e.g. "briefs" or "sources". */
  valueLabel?: string;
}) {
  const theme = chartCss();
const total = items.reduce((sum, i) => sum + Math.max(0, i.value), 0);
  const data = items.map((i, idx) => {
    const value = Math.max(0, i.value);
    const share = total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
    return {
      ...i,
      value,
      share,
      detail: i.detail || `${value.toLocaleString()} ${valueLabel} · ${share}% of mix`,
      color: i.color || CHART.palette[idx % CHART.palette.length],
    };
  });
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <ChartShell className={heightClass}>
      <div className={`chart-panel w-full ${heightClass}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 4, right: 32, top: 6, bottom: 6 }}
            barCategoryGap="22%"
          >
            <XAxis type="number" hide domain={[0, max * 1.12]} />
            <YAxis
              type="category"
              dataKey="label"
              width={88}
              tick={CHART.tick}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: CHART.cursor }}
              content={
                <ChartTooltipContent
                  formatter={(_v, _name, item) =>
                    String(item.payload?.detail ?? `${item.value ?? 0} ${valueLabel}`)
                  }
                />
              }
            />
            <Bar
              dataKey="value"
              name={valueLabel}
              radius={[0, 5, 5, 0]}
              barSize={16}
              background={{ fill: theme.track, radius: 5 }}
              activeBar={{ opacity: 0.88 }}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                fill={theme.label}
                fontSize={12}
                fontWeight={700}
                fontFamily="var(--font-mono)"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}

/** Dense vertical activity bars (operator / overview pulse style). */
export function ActivityBars({
  items,
  heightClass = TALL_CHART_HEIGHT,
  color = "#2DD4BF",
  valueLabel = "count",
}: {
  items: { label: string; value: number; color?: string; detail?: string }[];
  heightClass?: string;
  color?: string;
  valueLabel?: string;
}) {
  const data = items.map((i, idx) => ({
    ...i,
    value: Math.max(0, i.value),
    color: i.color || color || CHART.palette[idx % CHART.palette.length],
    detail: i.detail || `${Math.max(0, i.value).toLocaleString()} ${valueLabel}`,
  }));
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <ChartShell className={heightClass}>
      <div className={`chart-panel w-full ${heightClass}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ left: 4, right: 8, top: 10, bottom: 4 }}
            barCategoryGap="18%"
          >
            <XAxis
              dataKey="label"
              tick={CHART.tick}
              axisLine={false}
              tickLine={false}
              interval={0}
              height={36}
            />
            <YAxis type="number" hide domain={[0, max * 1.15]} />
            <Tooltip
              cursor={{ fill: CHART.cursor }}
              content={
                <ChartTooltipContent
                  formatter={(_v, _name, item) =>
                    String(item.payload?.detail ?? `${item.value ?? 0} ${valueLabel}`)
                  }
                />
              }
            />
            <Bar
              dataKey="value"
              name={valueLabel}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              activeBar={{ opacity: 0.9 }}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}

export function CapacityBars({
  items,
  heightClass = TALL_CHART_HEIGHT,
}: {
  items: { label: string; used: number; limit: number; color?: string }[];
  heightClass?: string;
}) {
  const theme = chartCss();
  const data = items.map((i, idx) => {
    const limit = Math.max(1, i.limit);
    const pct = Math.min(100, Math.round((i.used / limit) * 100));
    return {
      label: i.label,
      value: pct,
      display: `${i.used.toLocaleString()} / ${i.limit.toLocaleString()}`,
      color: i.color || CHART.palette[idx % CHART.palette.length],
    };
  });

  return (
    <ChartShell className={heightClass}>
      <div className={`chart-panel w-full ${heightClass}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 4, right: 108, top: 10, bottom: 10 }}
            barCategoryGap="30%"
          >
            <XAxis type="number" hide domain={[0, 100]} />
            <YAxis
              type="category"
              dataKey="label"
              width={80}
              tick={CHART.tick}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: CHART.cursor }}
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => {
                    const display = (item.payload as { display?: string })?.display;
                    return `${value}%${display ? ` · ${display}` : ""}`;
                  }}
                />
              }
            />
            <Bar
              dataKey="value"
              radius={[0, 6, 6, 0]}
              barSize={20}
              background={{ fill: theme.trackStrong, radius: 6 }}
              activeBar={{ opacity: 0.88 }}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
              <LabelList
                dataKey="display"
                position="right"
                fill={CHART.mist}
                fontSize={11}
                fontWeight={600}
                fontFamily="var(--font-mono)"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}

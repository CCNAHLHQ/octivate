"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { AutosaveStatus } from "@/components/operator/autosave-status";
import { OperatorLimitsPanel } from "@/components/operator/operator-limits-panel";
import { OperatorModularBoard } from "@/components/operator/operator-module";
import {
  CATALOG_LAYOUT,
  CONTROL_LAYOUT,
  PULSE_LAYOUT,
} from "@/components/operator/operator-layout-defaults";
import { OperatorSourcesPanel } from "@/components/operator/operator-sources-panel";
import { OperatorSourceProbePanel } from "@/components/operator/operator-source-probe-panel";
import { SourceProbeProvider } from "@/components/operator/source-probe-context";
import { OperatorSignalTickerPanel } from "@/components/operator/operator-signal-ticker-panel";
import { OperatorRuntimePanel } from "@/components/operator/operator-runtime-panel";
import { OperatorModelConfigPanel } from "@/components/operator/operator-model-config-panel";
import { OperatorEvidencePipelinePanel } from "@/components/operator/operator-evidence-pipeline-panel";
import { ProgressBar } from "@/components/ui/progress";
import { LazyDonutChart } from "@/components/ui/lazy-charts";
import {
  WorkspaceKpiStrip,
  type WorkspaceKpi,
} from "@/components/workspace/workspace-kpi-strip";
import { useOperatorLayout } from "@/lib/hooks/use-operator-layout";
import type { OperatorLimits, UsageSnapshot } from "@/lib/types";
import type { Health } from "@/components/operator/operator-types";

type ChartBundle = {
  sessions: ReactNode;
  capacity: ReactNode;
  cost: ReactNode;
  runtime: ReactNode;
};

export function buildOperatorCharts({
  sessionsTotal,
  sessionSegments,
  runningSessions,
  agentAvailable,
  tokenPct,
  tokensUsed,
  tokensPerDay,
  concurrentAgents,
  periodCostUsd,
  costSegments,
  health,
  pipelineLabel,
  keyConfigured,
  allowPremiumModels,
}: {
  sessionsTotal: number;
  sessionSegments: { name: string; value: number }[];
  runningSessions: number;
  agentAvailable: number;
  tokenPct: number;
  tokensUsed: number;
  tokensPerDay: number;
  concurrentAgents: number;
  periodCostUsd: number;
  costSegments: { name: string; value: number }[];
  health: Health;
  pipelineLabel: string;
  keyConfigured: boolean;
  allowPremiumModels: boolean;
}): ChartBundle {
  return {
    sessions: (
      <div className="op-module-chart">
        <p className="op-module-sub">{sessionsTotal} total</p>
        <LazyDonutChart centerLabel="sessions" segments={sessionSegments} />
      </div>
    ),
    capacity: (
      <div className="op-module-chart overview-usage-split">
        <p className="op-module-sub">Tokens & concurrency</p>
        <LazyDonutChart
          centerLabel="agents"
          segments={[
            { name: "Active", value: runningSessions },
            { name: "Available", value: agentAvailable },
          ]}
        />
        <div className="overview-usage-meter">
          <ProgressBar value={tokenPct} />
          <p className="overview-usage-tokens">
            {tokensUsed.toLocaleString()}
            <span> / {tokensPerDay.toLocaleString()} tokens</span>
          </p>
          <p className="mt-1 font-mono text-[10px] text-teal">
            {runningSessions} / {concurrentAgents} concurrent agents
          </p>
        </div>
      </div>
    ),
    cost: (
      <div className="op-module-chart">
        <p className="op-module-sub">${periodCostUsd.toFixed(2)} period spend</p>
        <LazyDonutChart centerLabel="USD" segments={costSegments} />
        <p className="op-module-sub" style={{ marginTop: "0.45rem" }}>
          By model this period
        </p>
      </div>
    ),
    runtime: (
      <OperatorRuntimePanel
        health={health}
        pipelineLabel={pipelineLabel}
        keyConfigured={keyConfigured}
        allowPremiumModels={allowPremiumModels}
      />
    ),
  };
}

export function OperatorPulseBoard({
  kpis,
  charts,
  pendingReviews,
  onClearStaleReviews,
  onClearAllReviews,
}: {
  kpis: WorkspaceKpi[];
  charts: ChartBundle;
  pendingReviews: {
    count: number;
    pending: {
      id: string;
      title: string;
      ownerName?: string;
      ownerEmail?: string;
      projectName?: string;
    }[];
  } | null;
  onClearStaleReviews?: () => void;
  onClearAllReviews?: () => void;
}) {
  const layout = useOperatorLayout("pulse", PULSE_LAYOUT);

  return (
    <OperatorModularBoard
      {...layout}
      resetLayout={layout.resetLayout}
      renderModule={(id) => {
        if (id === "kpis") {
          return {
            title: "Live KPIs",
            hint: "Click a metric to open its console view",
            node: <WorkspaceKpiStrip items={kpis} columns={3} />,
          };
        }
        if (id === "reviews") {
          const grouped = new Map<
            string,
            {
              label: string;
              email?: string;
              items: NonNullable<typeof pendingReviews>["pending"];
            }
          >();
          for (const row of pendingReviews?.pending || []) {
            const key = row.ownerEmail || row.ownerName || "unassigned";
            const existing = grouped.get(key);
            if (existing) existing.items.push(row);
            else {
              grouped.set(key, {
                label: row.ownerName || row.ownerEmail || "Unassigned / seed",
                email: row.ownerEmail,
                items: [row],
              });
            }
          }
          return {
            title: "Revision queue",
            hint: "Pending briefs paired by origin account",
            node: (
              <div className="op-review-inline">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[var(--amber)]">
                    <AlertTriangle className="h-4 w-4" aria-hidden />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest">
                      {pendingReviews?.count || 0} pending
                      {grouped.size > 0
                        ? ` · ${grouped.size} account${grouped.size === 1 ? "" : "s"}`
                        : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {onClearStaleReviews ? (
                      <button
                        type="button"
                        className="font-mono text-[10px] uppercase tracking-wider text-faint hover:text-mist"
                        onClick={onClearStaleReviews}
                      >
                        Clear stale
                      </button>
                    ) : null}
                    {onClearAllReviews ? (
                      <button
                        type="button"
                        className="font-mono text-[10px] uppercase tracking-wider text-coral hover:text-foam"
                        onClick={onClearAllReviews}
                      >
                        Clear all
                      </button>
                    ) : null}
                  </div>
                </div>
                {pendingReviews && pendingReviews.count > 0 ? (
                  <div className="space-y-3">
                    {[...grouped.values()].slice(0, 4).map((group) => (
                      <div
                        key={group.email || group.label}
                        className="rounded-[10px] border border-[var(--line)] px-2.5 py-2"
                      >
                        <p className="font-mono text-[10px] uppercase tracking-wider text-tide">
                          {group.label}
                          {group.email ? (
                            <span className="ml-1 text-faint normal-case tracking-normal">
                              {group.email}
                            </span>
                          ) : null}
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {group.items.slice(0, 4).map((b) => (
                            <li key={b.id}>
                              <Link
                                href={`/dashboard/briefs/${b.id}`}
                                className="text-sm text-foam hover:text-teal"
                              >
                                {b.title}
                              </Link>
                              {b.projectName ? (
                                <span className="mt-0.5 block font-mono text-[10px] text-faint">
                                  {b.projectName}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-mist">No briefs awaiting revision.</p>
                )}
              </div>
            ),
          };
        }
        if (id === "sessions") {
          return { title: "Session mix", hint: "Agent workflow states", node: charts.sessions };
        }
        if (id === "cost") {
          return { title: "Cost by model", hint: "Spend from cost ledger", node: charts.cost };
        }
        if (id === "capacity") {
          return { title: "Capacity", hint: "Token budget & concurrency", node: charts.capacity };
        }
        if (id === "runtime") {
          return {
            title: "Runtime",
            hint: "Live system status — drag to rearrange",
            bodyClassName: "p-0",
            node: <div className="op-module-embed">{charts.runtime}</div>,
          };
        }
        return null;
      }}
    />
  );
}

export function OperatorControlBoard({
  limits,
  usage,
  runningSessions,
  saveStatus,
  onChange,
  onFlush,
  onRetry,
  charts,
}: {
  limits: OperatorLimits;
  usage: UsageSnapshot;
  runningSessions: number;
  saveStatus: AutosaveStatus;
  onChange: (next: OperatorLimits) => void;
  onFlush?: () => void;
  onRetry?: () => void;
  charts: ChartBundle;
}) {
  const layout = useOperatorLayout("control", CONTROL_LAYOUT);

  return (
    <OperatorModularBoard
      {...layout}
      resetLayout={layout.resetLayout}
      renderModule={(id) => {
        if (id === "limits") {
          return {
            title: "Control plane",
            hint: "Usage limits for live runs — drag to rearrange",
            bodyClassName: "p-0",
            node: (
              <div className="op-module-embed">
                <OperatorLimitsPanel
                  embedded
                  limits={limits}
                  usage={usage}
                  runningSessions={runningSessions}
                  saveStatus={saveStatus}
                  onChange={onChange}
                  onFlush={onFlush}
                  onRetry={onRetry}
                />
              </div>
            ),
          };
        }
        if (id === "models") {
          return {
            title: "Model routing",
            hint: "resolveModel · docs class · token budgets",
            bodyClassName: "p-0",
            node: (
              <div className="op-module-embed">
                <OperatorModelConfigPanel embedded />
              </div>
            ),
          };
        }
        if (id === "evidence") {
          return {
            title: "Evidence pipeline",
            hint: "scoreBriefConfidence weights · autosave",
            bodyClassName: "p-0",
            node: (
              <div className="op-module-embed">
                <OperatorEvidencePipelinePanel />
              </div>
            ),
          };
        }
        if (id === "capacity") {
          return { title: "Capacity", hint: "Live concurrency meters", node: charts.capacity };
        }
        if (id === "runtime") {
          return {
            title: "Runtime",
            hint: "Live system status — drag to rearrange",
            bodyClassName: "p-0",
            node: <div className="op-module-embed">{charts.runtime}</div>,
          };
        }
        return null;
      }}
    />
  );
}

export function OperatorCatalogBoard() {
  const layout = useOperatorLayout("catalog-v2", CATALOG_LAYOUT);

  return (
    <SourceProbeProvider>
      <OperatorModularBoard
        {...layout}
        resetLayout={layout.resetLayout}
        renderModule={(id) => {
          if (id === "autocheck") {
            return {
              title: "Auto-check",
              hint: "Availability probes & cadence — drag to rearrange",
              bodyClassName: "p-0",
              node: (
                <div className="op-module-embed">
                  <OperatorSourceProbePanel embedded section="autocheck" />
                </div>
              ),
            };
          }
          if (id === "capture") {
            return {
              title: "Source capture",
              hint: "Artifact queue & path — drag to rearrange",
              bodyClassName: "p-0",
              node: (
                <div className="op-module-embed">
                  <OperatorSourceProbePanel embedded section="capture" />
                </div>
              ),
            };
          }
          if (id === "sources") {
            return {
              title: "Sources",
              hint: "Live registry — drag to rearrange",
              bodyClassName: "p-0",
              node: (
                <div className="op-module-embed">
                  <OperatorSourcesPanel embedded />
                </div>
              ),
            };
          }
          if (id === "ticker") {
            return {
              title: "Signal ticker",
              hint: "Live site marquee — compose, preview, queue",
              bodyClassName: "p-0",
              node: (
                <div className="op-module-embed is-ticker">
                  <OperatorSignalTickerPanel embedded />
                </div>
              ),
            };
          }
          return null;
        }}
      />
    </SourceProbeProvider>
  );
}

"use client";

import { Activity, FileText, Gauge, Layers } from "lucide-react";
import type { AgentSession } from "@/lib/types";

/**
 * Compact stats strip for the project workable area — honest figures from the
 * live session / document count (no mock padding).
 */
export function ProjectInsights({
  session,
  documentCount,
  monitorCount,
}: {
  session?: AgentSession | null;
  documentCount: number;
  monitorCount: number;
}) {
  const stages = session?.stages ?? [];
  const done = stages.filter((s) => s.status === "completed").length;
  const total = stages.length || 8;
  const progress = session
    ? session.status === "completed"
      ? 100
      : Math.round((done / total) * 100)
    : 0;

  const tiles = [
    {
      icon: Layers,
      label: "Stages",
      value: session ? `${done}/${total}` : "—",
      hint: session ? "Completed agents" : "Awaiting run",
    },
    {
      icon: Gauge,
      label: "Progress",
      value: `${progress}%`,
      hint: session?.status ?? "idle",
    },
    {
      icon: FileText,
      label: "Documents",
      value: String(documentCount),
      hint: "On project",
    },
    {
      icon: Activity,
      label: "Tokens",
      value: session ? session.tokensUsed.toLocaleString() : "0",
      hint: session ? `$${session.estimatedCostUsd.toFixed(4)}` : "No spend yet",
    },
  ];

  return (
    <div className="ws-insights">
      <div className="ws-insights-head">
        <h2 className="ws-section-title">Workspace pulse</h2>
        <p className="ws-section-sub">
          Live stats from this project{monitorCount ? ` · ${monitorCount} linked monitor${monitorCount > 1 ? "s" : ""}` : ""}.
        </p>
      </div>
      <div className="ws-insights-grid">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="ws-insight-tile">
              <div className="ws-insight-icon">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <div className="ws-insight-label">{t.label}</div>
              <div className="ws-insight-value">{t.value}</div>
              <div className="ws-insight-hint">{t.hint}</div>
            </div>
          );
        })}
      </div>
      <div className="ws-insights-bar" aria-hidden>
        <span style={{ width: `${Math.max(progress, 2)}%` }} />
      </div>
    </div>
  );
}

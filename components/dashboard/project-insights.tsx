"use client";

import { Activity, FileText, Gauge, Layers } from "lucide-react";
import { useT } from "@/components/i18n/locale-provider";
import type { AgentSession } from "@/lib/types";

/**
 * Compact stats strip for the project workable area — honest figures from the
 * live session / document count (no mock padding).
 */
export function ProjectInsights({
  session,
  documentCount,
}: {
  session?: AgentSession | null;
  documentCount: number;
}) {
  const t = useT();
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
      hint: session ? t("ws.pulse.completedAgents") : t("ws.pulse.awaitingRun"),
    },
    {
      icon: Gauge,
      label: "Progress",
      value: `${progress}%`,
      hint: session?.status ?? "idle",
    },
    {
      icon: FileText,
      label: t("ws.project.module.documents"),
      value: String(documentCount),
      hint: t("ws.pulse.onProject"),
    },
    {
      icon: Activity,
      label: "Tokens",
      value: session ? session.tokensUsed.toLocaleString() : "0",
      hint: session ? `$${session.estimatedCostUsd.toFixed(4)}` : t("ws.pulse.noSpend"),
    },
  ];

  return (
    <div className="ws-insights">
      <div className="ws-insights-head">
        <h2 className="ws-section-title">{t("ws.pulse.title")}</h2>
        <p className="ws-section-sub">Live stats from this project.</p>
      </div>
      <div className="ws-insights-grid">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="ws-insight-tile">
              <div className="ws-insight-icon">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <div className="ws-insight-label">{tile.label}</div>
              <div className="ws-insight-value">{tile.value}</div>
              <div className="ws-insight-hint">{tile.hint}</div>
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

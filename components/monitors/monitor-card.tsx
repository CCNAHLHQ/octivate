"use client";

import Link from "next/link";
import { Activity, Bell, Clock, Pause } from "lucide-react";
import { StatusBadge, severityTone } from "@/components/ui/status-badge";
import type { Monitor } from "@/lib/types";

function formatRelative(iso?: string) {
  if (!iso) return "No alerts yet";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Alert today";
  if (days === 1) return "Alert yesterday";
  if (days < 14) return `Alert ${days}d ago`;
  return `Alert ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function MonitorCard({ monitor, projectName }: { monitor: Monitor; projectName?: string }) {
  return (
    <Link href={`/dashboard/monitors/${monitor.id}`} className="ws-monitor-card">
      <article className="ws-monitor-card-inner">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {monitor.status === "paused" ? (
                <Pause className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
              ) : (
                <Activity className="h-3.5 w-3.5 shrink-0 text-teal" aria-hidden />
              )}
              <h3 className="font-display text-base font-semibold text-foam">{monitor.name}</h3>
            </div>
            <p className="ws-card-meta mt-1">
              {monitor.countries.join(" · ")}
              {projectName ? ` · ${projectName}` : ""}
            </p>
          </div>
          <StatusBadge tone={severityTone(monitor.status)}>{monitor.status}</StatusBadge>
        </div>
        <div className="ws-tag-row">
          {monitor.keywords.slice(0, 4).map((kw) => (
            <span key={kw} className="ws-tag">
              {kw}
            </span>
          ))}
          {monitor.keywords.length > 4 && (
            <span className="ws-tag">+{monitor.keywords.length - 4}</span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="ws-monitor-alert inline-flex items-center gap-1">
            <Bell className="h-3 w-3" aria-hidden />
            {monitor.alertCount} alert{monitor.alertCount === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-faint">
            <Clock className="h-3 w-3" aria-hidden />
            {formatRelative(monitor.lastAlertAt)}
          </span>
        </div>
      </article>
    </Link>
  );
}

export function MonitorCardSkeleton() {
  return (
    <div className="ws-monitor-card-inner animate-pulse">
      <div className="h-5 w-1/2 rounded bg-white/10" />
      <div className="mt-2 h-3 w-2/3 rounded bg-white/5" />
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-14 rounded-full bg-white/5" />
        <div className="h-5 w-14 rounded-full bg-white/5" />
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { ArrowUpRight, FileText, Globe } from "lucide-react";
import type { Brief } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Workspace-aligned badge tones — violet / mist / amber only (no coral/teal). */
export function briefBadgeTone(
  kind: "risk" | "review" | "status",
  value: string
): "violet" | "mist" | "amber" {
  const v = value.toLowerCase().replace(/_/g, " ");
  if (kind === "risk") {
    if (v === "critical" || v === "high") return "violet";
    if (v === "medium") return "amber";
    return "mist";
  }
  if (kind === "review") {
    if (v === "pending review" || v === "pending_review" || v === "needs revision") return "amber";
    if (v === "approved") return "violet";
    if (v === "rejected") return "mist";
    return "mist";
  }
  if (v === "final") return "violet";
  if (v === "draft") return "mist";
  return "mist";
}

function formatRelative(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function reviewChip(brief: Brief): { label: string; tone: "active" | "archived" | "amber" } {
  if (brief.reviewStatus === "approved" || brief.status === "final") {
    return { label: "Approved", tone: "active" };
  }
  if (brief.reviewStatus === "pending_review") {
    return { label: "pending review", tone: "amber" };
  }
  if (brief.reviewStatus === "rejected") {
    return { label: "Rejected", tone: "archived" };
  }
  return { label: "Draft", tone: "archived" };
}

function depthLabel(brief: Brief) {
  if (brief.analysisDepth === "deep_dive") return "Deep dive";
  if (brief.analysisDepth === "rapid") return "Rapid";
  if (brief.analysisDepth === "standard") return "Standard";
  return null;
}

export function BriefCard({ brief }: { brief: Brief }) {
  const chip = reviewChip(brief);
  const depth = depthLabel(brief);
  const summary =
    brief.executiveSummary?.trim() ||
    "Decision brief ready — open for executive summary, PSN lenses, and export.";

  return (
    <article className="ws-project-card">
      <div className="ws-project-card-inner">
        <div className="ws-project-card-top">
          <Link
            href={`/dashboard/briefs/${brief.id}`}
            className="ws-project-card-title-link"
          >
            <h3 className="ws-project-card-title">{brief.title}</h3>
          </Link>
          <div className="ws-project-card-top-right">
            <span
              className={cn(
                "ws-status-chip",
                chip.tone === "active" && "is-active",
                chip.tone === "archived" && "is-archived",
                chip.tone === "amber" && "is-amber"
              )}
            >
              {chip.label}
            </span>
          </div>
        </div>

        <Link
          href={`/dashboard/briefs/${brief.id}`}
          className="ws-project-card-body-link"
        >
          <p className="ws-card-meta">
            <Globe className="ws-card-meta-ico" aria-hidden />
            {brief.country}
            <span className="ws-card-meta-sep" aria-hidden>
              ·
            </span>
            {brief.sector}
          </p>
          <p className="ws-card-body line-clamp-2">{summary}</p>
        </Link>

        <div className="ws-project-card-foot">
          <div className="ws-project-card-stats">
            <span>
              <FileText className="h-3.5 w-3.5" aria-hidden />
              {brief.confidence}% confidence
            </span>
            <span>{formatRelative(brief.createdAt)}</span>
          </div>
          <div className="ws-project-card-actions">
            {depth ? <span className="ws-chip ws-chip-mist">{depth}</span> : null}
            <span
              className={cn(
                "ws-chip",
                brief.riskLevel === "critical" || brief.riskLevel === "high"
                  ? "ws-chip-violet"
                  : brief.riskLevel === "medium"
                    ? "ws-chip-amber"
                    : "ws-chip-mist"
              )}
            >
              {brief.riskLevel}
            </span>
            <Link href={`/dashboard/briefs/${brief.id}`} className="ws-card-cta">
              Open
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export function BriefCardSkeleton() {
  return (
    <div className="ws-project-card-inner animate-pulse">
      <div className="h-5 w-2/3 rounded bg-white/10" />
      <div className="mt-2 h-3 w-1/2 rounded bg-white/5" />
      <div className="mt-4 h-10 w-full rounded bg-white/5" />
    </div>
  );
}

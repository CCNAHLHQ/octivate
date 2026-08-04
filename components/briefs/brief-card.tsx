"use client";

import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
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

function BriefPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "violet" | "mist" | "amber";
}) {
  return <span className={cn("ws-brief-pill", `is-${tone}`)}>{children}</span>;
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function BriefCard({ brief }: { brief: Brief }) {
  const review = brief.reviewStatus?.replace(/_/g, " ");
  const depth =
    brief.analysisDepth === "deep_dive"
      ? "Deep dive"
      : brief.analysisDepth
        ? brief.analysisDepth.charAt(0).toUpperCase() + brief.analysisDepth.slice(1)
        : null;

  return (
    <Link href={`/dashboard/briefs/${brief.id}`} className="ws-brief-card">
      <article className="ws-brief-card-inner">
        <div className="ws-brief-card-top">
          <div className="ws-brief-card-icon" aria-hidden>
            <FileText className="h-4 w-4" />
          </div>
          <div className="ws-brief-card-pills">
            <BriefPill tone={briefBadgeTone("risk", brief.riskLevel)}>{brief.riskLevel}</BriefPill>
            {review ? (
              <BriefPill tone={briefBadgeTone("review", brief.reviewStatus || "")}>
                {review}
              </BriefPill>
            ) : (
              <BriefPill tone={briefBadgeTone("status", brief.status)}>{brief.status}</BriefPill>
            )}
            {depth ? <BriefPill tone="mist">{depth}</BriefPill> : null}
          </div>
        </div>

        <h2 className="ws-brief-card-title">{brief.title}</h2>
        <p className="ws-brief-card-meta">
          {brief.country} · {brief.sector}
        </p>
        <p className="ws-brief-card-summary">{brief.executiveSummary}</p>

        <footer className="ws-brief-card-foot">
          <div className="ws-brief-card-stats">
            <span>{brief.confidence}% confidence</span>
            <span>{formatWhen(brief.createdAt)}</span>
          </div>
          <span className="ws-brief-card-open">
            Open
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </footer>
      </article>
    </Link>
  );
}

export function BriefCardSkeleton() {
  return (
    <div className="ws-brief-card-inner animate-pulse">
      <div className="h-8 w-24 rounded-md bg-white/10" />
      <div className="mt-3 h-5 w-4/5 rounded bg-white/10" />
      <div className="mt-2 h-3 w-1/2 rounded bg-white/5" />
      <div className="mt-4 h-16 w-full rounded bg-white/5" />
      <div className="mt-4 h-3 w-1/3 rounded bg-white/5" />
    </div>
  );
}

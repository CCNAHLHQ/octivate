"use client";

import Link from "next/link";
import { ArrowUpRight, FileText, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { countryFlagUrl, resolveCountryOption } from "@/lib/geo/countries";
import type { Project } from "@/lib/types";

function formatRelative(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ProjectCard({ project }: { project: Project }) {
  const hasQuestion = Boolean(project.question?.trim());
  const isActive = project.status === "active";
  const country = resolveCountryOption(project.country);
  const flagSrc = country ? countryFlagUrl(country.code, 20) : "";

  return (
    <Link href={`/dashboard/projects/${project.id}`} className="ws-project-card">
      <article className="ws-project-card-inner">
        <div className="ws-project-card-top">
          <h3 className="ws-project-card-title">{project.name}</h3>
          <span className={cn("ws-status-chip", isActive ? "is-active" : "is-archived")}>
            {isActive ? "Active" : "Archived"}
          </span>
        </div>
        <p className="ws-card-meta">
          {flagSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={flagSrc}
              alt=""
              width={16}
              height={12}
              className="ws-country-flag"
              loading="lazy"
            />
          ) : (
            <Globe className="ws-card-meta-ico" aria-hidden />
          )}
          {project.country}
          <span className="ws-card-meta-sep" aria-hidden>
            ·
          </span>
          {project.sector}
        </p>
        <p className="ws-card-body line-clamp-2">
          {hasQuestion
            ? project.question
            : "No strategic question yet — open to run the agent workflow."}
        </p>
        <div className="ws-project-card-foot">
          <div className="ws-project-card-stats">
            <span>
              <FileText className="h-3.5 w-3.5" aria-hidden />
              {project.documents.length}{" "}
              {project.documents.length === 1 ? "doc" : "docs"}
            </span>
            <span>Updated {formatRelative(project.updatedAt)}</span>
          </div>
          <div className="ws-project-card-actions">
            {hasQuestion ? (
              <span className="ws-chip ws-chip-violet">Question ready</span>
            ) : (
              <span className="ws-chip ws-chip-mist">Needs question</span>
            )}
            <span className="ws-card-cta">
              Open
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="ws-project-card-inner animate-pulse">
      <div className="h-5 w-2/3 rounded bg-white/10" />
      <div className="mt-2 h-3 w-1/2 rounded bg-white/5" />
      <div className="mt-4 h-10 w-full rounded bg-white/5" />
    </div>
  );
}

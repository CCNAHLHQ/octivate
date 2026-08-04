"use client";

import { StakeholderEmblemArt } from "@/components/stakeholders/stakeholder-emblem";
import type { Stakeholder } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StakeholdersGallery({
  stakeholders,
  className,
}: {
  stakeholders: Stakeholder[];
  className?: string;
}) {
  if (!stakeholders.length) {
    return (
      <p className="sth-empty">
        No sponsors are listed yet. When institutions stand with the cause, they appear here.
      </p>
    );
  }

  return (
    <ol className={cn("sth-gallery", className)}>
      {stakeholders.map((s, i) => (
        <li
          key={s.id}
          className="sth-entry"
          style={{ animationDelay: `${Math.min(i, 6) * 90}ms` }}
        >
          <StakeholderEmblemArt
            emblem={s.emblem}
            recognition={s.recognition}
            title={s.name}
          />
          <div className="sth-entry-copy">
            <p className="sth-entry-kicker">
              <span>{s.country}</span>
              <span className="sth-entry-dot" aria-hidden />
              <span>{s.org}</span>
            </p>
            <h2 className="sth-entry-name">{s.name}</h2>
            <p className="sth-entry-cause">{s.cause}</p>
            <p className="sth-entry-sponsorship">{s.sponsorship}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

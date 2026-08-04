"use client";

import type { BriefCitedSource } from "@/lib/types";
import { highlightSegments } from "@/lib/evidence/citations";
import { cn } from "@/lib/utils";

/** Render text with local citation passages highlighted. */
export function PassageHighlighter({
  text,
  sources,
  className,
}: {
  text: string;
  sources?: BriefCitedSource[];
  className?: string;
}) {
  const needles = (sources || []).flatMap((s) =>
    (s.passages || []).map((p) => p.text).concat(s.snippet ? [s.snippet] : [])
  );
  const segs = highlightSegments(text, needles);
  if (!segs.some((s) => s.hit)) {
    return <span className={className}>{text}</span>;
  }
  return (
    <span className={cn("brief-hl-root", className)}>
      {segs.map((s, i) =>
        s.hit ? (
          <mark key={i} className="brief-hl" title="Supported by local capture text">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </span>
  );
}

export function PassageQuoteList({
  sources,
  className,
}: {
  sources: BriefCitedSource[];
  className?: string;
}) {
  const rows = sources.flatMap((s) =>
    (s.passages || []).map((p, i) => ({
      key: `${s.id}-${i}`,
      label: s.label,
      title: s.title,
      text: p.text,
      score: p.score,
    }))
  );
  if (!rows.length) return null;
  return (
    <ul className={cn("brief-passage-list", className)}>
      {rows.slice(0, 8).map((r) => (
        <li key={r.key}>
          <div className="brief-passage-meta">
            <span>{r.label}</span>
            <span>{r.title}</span>
            {r.score != null ? <span>{Math.round(r.score * 100)}% match</span> : null}
          </div>
          <blockquote className="brief-passage-quote">“{r.text}”</blockquote>
        </li>
      ))}
    </ul>
  );
}

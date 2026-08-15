"use client";

import { useState, type ReactNode } from "react";
import { ExternalLink, FileText } from "lucide-react";
import type { Brief, BriefCitedSource, MaterialFinding } from "@/lib/types";
import { coerceTextList } from "@/lib/briefs/normalize";
import { SourceChip, withInlineSourceChips } from "@/components/briefs/source-chip";
import {
  PassageHighlighter,
  PassageQuoteList,
} from "@/components/briefs/passage-highlighter";
import { cn } from "@/lib/utils";

function CardShell({
  label,
  children,
  className,
  accent,
  collapsible,
  defaultOpen = true,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  accent?: "power" | "systems" | "narratives";
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cn("brief-card", accent && `is-${accent}`, className)}>
      {collapsible ? (
        <button
          type="button"
          className={cn("brief-card-toggle", accent && `is-${accent}`)}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{label}</span>
          <span className="brief-card-chevron" aria-hidden>
            {open ? "−" : "+"}
          </span>
        </button>
      ) : (
        <h2 className={cn("brief-card-label", accent && `is-${accent}`)}>{label}</h2>
      )}
      {(!collapsible || open) && <div className="brief-card-body">{children}</div>}
    </section>
  );
}

function BulletList({
  items,
  sources,
  dense,
}: {
  items: unknown;
  sources?: BriefCitedSource[];
  dense?: boolean;
}) {
  const list = coerceTextList(items);
  if (!list.length) return <p className="brief-empty">None recorded.</p>;
  const long = dense || list.length > 6 || list.some((i) => i.length > 220);
  if (long) {
    return (
      <details className="brief-accordion" open={list.length <= 4}>
        <summary>
          {list.length} item{list.length === 1 ? "" : "s"} — expand
        </summary>
        <ul className="brief-bullets">
          {list.map((item) => (
            <li key={item}>
              {/\bSource\s+\d+\b/i.test(item)
                ? withInlineSourceChips(item, sources)
                : <PassageHighlighter text={item} sources={sources} />}
            </li>
          ))}
        </ul>
      </details>
    );
  }
  return (
    <ul className="brief-bullets">
      {list.map((item) => (
        <li key={item}>
          {/\bSource\s+\d+\b/i.test(item)
            ? withInlineSourceChips(item, sources)
            : <PassageHighlighter text={item} sources={sources} />}
        </li>
      ))}
    </ul>
  );
}

function PsnTabs({
  brief,
}: {
  brief: Brief;
}) {
  const structured = brief.structuredFindings;
  const tabs = [
    {
      id: "power" as const,
      label: "Power",
      items: brief.power,
      findings: structured?.power,
    },
    {
      id: "systems" as const,
      label: "Systems",
      items: brief.systems,
      findings: structured?.systems,
    },
    {
      id: "narratives" as const,
      label: "Narrative",
      items: brief.narratives,
      findings: structured?.narratives,
    },
  ];
  const [active, setActive] = useState<(typeof tabs)[number]["id"]>("power");
  const current = tabs.find((t) => t.id === active) || tabs[0];
  const lines =
    current.findings && current.findings.length
      ? current.findings.map((f: MaterialFinding) => f.finding || f.decision_effect).filter(Boolean)
      : current.items;

  return (
    <CardShell label="PSN lenses" className="brief-card-psn">
      <div className="brief-psn-tabs" role="tablist" aria-label="PSN lenses">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            className={cn("brief-psn-tab", `is-${t.id}`, active === t.id && "is-active")}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={cn("brief-psn-panel", `is-${current.id}`)} role="tabpanel">
        {lines.length ? (
          <ul className="brief-psn-list">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="brief-empty">No material findings for this lens.</p>
        )}
      </div>
    </CardShell>
  );
}

function ScoreBreakdown({ brief }: { brief: Brief }) {
  const b = brief.scoreBreakdown;
  if (!b) return null;
  const rows = [
    { label: "Source scores", value: b.parts.sourceScore, w: b.policy.sourceScoreW },
    { label: "Label match", value: b.parts.labelMatch, w: b.policy.labelMatchW },
    { label: "Agent confidence", value: b.parts.agentConf, w: b.policy.agentConfW },
    { label: "Triangulation", value: b.parts.triangulation, w: b.policy.triangulationW },
    { label: "Freshness", value: b.parts.freshness, w: b.policy.freshnessW },
  ];
  return (
    <CardShell label="Confidence breakdown" collapsible defaultOpen={false}>
      <p className="brief-score-total">{b.total}% weighted confidence</p>
      <ul className="brief-score-rows">
        {rows.map((r) => (
          <li key={r.label}>
            <span>
              {r.label} <em>(w {r.w})</em>
            </span>
            <strong>{r.value}</strong>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

function CitedSources({ sources }: { sources: BriefCitedSource[] }) {
  if (!sources.length) return null;
  return (
    <CardShell label="Cited sources">
      <ul className="brief-cite-min">
        {sources.map((s) => (
          <li key={s.id}>
            <div className="brief-cite-min-main">
              <span className="brief-cite-label">{s.label}</span>
              <span className="brief-cite-title">{s.title}</span>
              {s.snippet ? (
                <p className="brief-cite-snip">
                  <PassageHighlighter text={s.snippet} sources={[s]} />
                </p>
              ) : null}
              {s.labels?.length ? (
                <div className="brief-cite-tags">
                  {s.labels.slice(0, 5).map((l) => (
                    <span key={l}>{l.replace(/^(psn|sector|relevance):/, "")}</span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="brief-cite-actions">
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="brief-cite-icon"
                  title="Open source URL"
                  aria-label={`Open ${s.title}`}
                >
                  <ExternalLink size={16} strokeWidth={1.75} />
                </a>
              ) : null}
              {s.captureFolder ? (
                <span
                  className="brief-cite-icon is-local"
                  title={`Local capture ${s.captureFolder}`}
                  aria-label="Local capture available"
                >
                  <FileText size={16} strokeWidth={1.75} />
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <PassageQuoteList sources={sources} />
    </CardShell>
  );
}

export function BriefDocument({
  brief,
  footer,
  className,
}: {
  brief: Brief;
  footer?: ReactNode;
  className?: string;
}) {
  const sources = brief.citedSources || [];
  const gaps = coerceTextList(brief.evidenceGaps ?? brief.gaps);

  return (
    <div className={cn("brief-doc brief-doc-modular", className)}>
      {(brief.depthDisclaimer || brief.analysisDepth || brief.reviewStatus) && (
        <div className="brief-meta-strip">
          {brief.analysisDepth ? (
            <span className="brief-meta-pill">
              Depth · {brief.analysisDepth === "deep_dive" ? "Deep dive" : brief.analysisDepth}
            </span>
          ) : null}
          {brief.reviewStatus ? (
            <span className="brief-meta-pill">Review · {brief.reviewStatus.replace(/_/g, " ")}</span>
          ) : null}
          {brief.status ? <span className="brief-meta-pill">Status · {brief.status}</span> : null}
          {brief.localOnlySources ? (
            <span className="brief-meta-pill">Local sources only</span>
          ) : null}
          {brief.depthDisclaimer ? (
            <span className="brief-meta-note">{brief.depthDisclaimer}</span>
          ) : null}
        </div>
      )}

      <CardShell label="Executive summary" collapsible>
        <p className="brief-summary">
          <PassageHighlighter text={brief.executiveSummary} sources={sources} />
        </p>
        {brief.analyticalJudgement ? (
          <details className="brief-accordion">
            <summary>Analytical judgement</summary>
            <p className="brief-judgement">
              <PassageHighlighter text={brief.analyticalJudgement} sources={sources} />
            </p>
          </details>
        ) : null}
      </CardShell>

      <div className="brief-grid-2">
        <CardShell label="Recommendations / variants" collapsible>
          <BulletList items={brief.recommendations} sources={sources} dense />
          {brief.tradeoffs && brief.tradeoffs.length > 0 ? (
            <>
              <h3 className="brief-subhead">Tradeoffs</h3>
              <BulletList items={brief.tradeoffs} sources={sources} dense />
            </>
          ) : null}
        </CardShell>
        <CardShell label="Evidence gaps" collapsible>
          <BulletList items={gaps} sources={sources} dense />
          {sources.length > 0 ? (
            <div className="brief-source-row">
              {sources.slice(0, 4).map((s) => (
                <SourceChip key={s.id} source={s} />
              ))}
            </div>
          ) : null}
        </CardShell>
      </div>

      <PsnTabs brief={brief} />

      {brief.psnInteractions && brief.psnInteractions.length > 0 ? (
        <CardShell label="PSN interactions" collapsible>
          <div className="brief-interactions">
            {brief.psnInteractions.map((psn) => (
              <article key={psn.interaction_id} className="brief-interaction">
                <p className="brief-interaction-main">{psn.causal_interaction}</p>
                <p className="brief-interaction-effect">{psn.decision_effect}</p>
                <div className="brief-interaction-comps">
                  <span>Power · {psn.power_component}</span>
                  <span>Systems · {psn.systems_component}</span>
                  <span>Narratives · {psn.narrative_component}</span>
                </div>
              </article>
            ))}
          </div>
        </CardShell>
      ) : null}

      <ScoreBreakdown brief={brief} />
      <CitedSources sources={sources} />

      {footer}
    </div>
  );
}

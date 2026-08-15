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
import { ConfidenceGauge } from "@/components/ui/charts";
import { cn } from "@/lib/utils";

type BriefDocTab = "confidence" | "judgement" | "analysis" | "sources";

const DOC_TABS: { id: BriefDocTab; label: string }[] = [
  { id: "confidence", label: "Confidence" },
  { id: "judgement", label: "Judgement" },
  { id: "analysis", label: "Analysis" },
  { id: "sources", label: "Sources" },
];

function CardShell({
  label,
  children,
  className,
  accent,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  accent?: "power" | "systems" | "narratives";
}) {
  return (
    <section className={cn("brief-card", accent && `is-${accent}`, className)}>
      <h2 className={cn("brief-card-label", accent && `is-${accent}`)}>{label}</h2>
      <div className="brief-card-body">{children}</div>
    </section>
  );
}

function BulletList({
  items,
  sources,
}: {
  items: unknown;
  sources?: BriefCitedSource[];
}) {
  const list = coerceTextList(items);
  if (!list.length) return <p className="brief-empty">None recorded.</p>;
  return (
    <ul className="brief-bullets brief-bullets-roomy">
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

function PsnTabs({ brief }: { brief: Brief }) {
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
    <CardShell label="PSN lenses" className="brief-card-psn" accent={current.id}>
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
          <ul className="brief-psn-list brief-bullets-roomy">
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

function coverageBannerNote(brief: Brief): string | null {
  const cov = brief.evidenceCoverage;
  if (!cov) return null;
  const skipped = cov.skippedDocIds?.length ?? 0;
  if (skipped <= 0 && !cov.truncated) return null;
  if (cov.note?.trim()) return cov.note.trim();
  const parts = [
    `Included ${cov.includedDocs} of ${cov.totalDocs} documents (${cov.charCount.toLocaleString()} / ${cov.charBudget.toLocaleString()} chars).`,
  ];
  if (skipped > 0) {
    parts.push(`${skipped} document(s) excluded from the packed evidence window.`);
  }
  if (cov.truncated) {
    parts.push("Evidence packing was truncated to the character budget.");
  }
  return parts.join(" ");
}

function CoverageBanner({ brief }: { brief: Brief }) {
  const note = coverageBannerNote(brief);
  if (!note) return null;
  return (
    <div className="brief-coverage-banner" role="status">
      <p className="brief-coverage-banner-kicker">Evidence coverage</p>
      <p className="brief-coverage-banner-note">{note}</p>
    </div>
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
    <CardShell label="Score breakdown">
      <p className="brief-score-total">{b.total}% weighted confidence</p>
      <ul className="brief-score-meters">
        {rows.map((r) => {
          const pct = Math.max(0, Math.min(100, Number(r.value) || 0));
          return (
            <li key={r.label} className="brief-score-meter">
              <div className="brief-score-meter-head">
                <span className="brief-score-meter-label">
                  {r.label} <em>(w {r.w})</em>
                </span>
                <strong className="brief-score-meter-value">{r.value}</strong>
              </div>
              <div
                className="brief-score-meter-track"
                role="meter"
                aria-label={r.label}
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="brief-score-meter-fill" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </CardShell>
  );
}

function CitedSources({ sources }: { sources: BriefCitedSource[] }) {
  if (!sources.length) {
    return <p className="brief-empty">No cited sources recorded.</p>;
  }
  return (
    <div className="brief-sources-stack">
      <ul className="brief-cite-full">
        {sources.map((s) => (
          <li key={s.id} className="brief-cite-card">
            <div className="brief-cite-card-head">
              <div className="brief-cite-min-main">
                <span className="brief-cite-label">{s.label}</span>
                <span className="brief-cite-title">{s.title}</span>
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="brief-cite-url"
                  >
                    {s.url}
                  </a>
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
            </div>
            {s.snippet ? (
              <p className="brief-cite-snip brief-cite-snip-full">
                <PassageHighlighter text={s.snippet} sources={[s]} />
              </p>
            ) : null}
            {(s.relevanceScore != null || (s.matchedKeywords && s.matchedKeywords.length > 0)) ? (
              <div className="brief-cite-relevance">
                {s.relevanceScore != null ? (
                  <span>Relevance · {Math.round(s.relevanceScore * 100)}%</span>
                ) : null}
                {(s.matchedKeywords || []).slice(0, 8).map((kw) => (
                  <span key={kw}>{kw}</span>
                ))}
              </div>
            ) : null}
            {s.labels?.length ? (
              <div className="brief-cite-tags">
                {s.labels.slice(0, 8).map((l) => (
                  <span key={l}>{l.replace(/^(psn|sector|relevance):/, "")}</span>
                ))}
              </div>
            ) : null}
            {s.ungrounded ? (
              <p className="brief-cite-ungrounded">No accepted local passage grounded for this cite.</p>
            ) : null}
          </li>
        ))}
      </ul>
      <PassageQuoteList sources={sources} />
    </div>
  );
}

function ConfidenceTab({ brief }: { brief: Brief }) {
  return (
    <div className="brief-tab-panel brief-tab-confidence">
      <CoverageBanner brief={brief} />
      <div className="brief-conf-hero">
        <div className="brief-conf-gauge">
          <ConfidenceGauge value={brief.confidence} />
        </div>
        <div className="brief-conf-side">
          <p className="brief-conf-kicker">Risk & status</p>
          <div className="brief-meta-strip">
            <span className={cn("brief-meta-pill", `is-risk-${brief.riskLevel}`)}>
              Risk · {brief.riskLevel}
            </span>
            {brief.analysisDepth ? (
              <span className="brief-meta-pill">
                Depth · {brief.analysisDepth === "deep_dive" ? "Deep dive" : brief.analysisDepth}
              </span>
            ) : null}
            {brief.reviewStatus ? (
              <span className="brief-meta-pill">
                Review · {brief.reviewStatus.replace(/_/g, " ")}
              </span>
            ) : null}
            {brief.status ? <span className="brief-meta-pill">Status · {brief.status}</span> : null}
            {brief.localOnlySources ? (
              <span className="brief-meta-pill">Local sources only</span>
            ) : null}
          </div>
          {brief.depthDisclaimer ? (
            <p className="brief-meta-note brief-conf-disclaimer">{brief.depthDisclaimer}</p>
          ) : null}
        </div>
      </div>
      <ScoreBreakdown brief={brief} />
    </div>
  );
}

function JudgementTab({ brief, sources }: { brief: Brief; sources: BriefCitedSource[] }) {
  const gaps = coerceTextList(brief.evidenceGaps ?? brief.gaps);
  return (
    <div className="brief-tab-panel brief-tab-judgement">
      <CoverageBanner brief={brief} />
      {brief.analyticalJudgement ? (
        <CardShell label="Analytical judgement">
          <p className="brief-judgement brief-prose">
            <PassageHighlighter text={brief.analyticalJudgement} sources={sources} />
          </p>
        </CardShell>
      ) : (
        <CardShell label="Analytical judgement">
          <p className="brief-empty">No analytical judgement recorded.</p>
        </CardShell>
      )}
      <CardShell label="Recommendations / variants">
        <BulletList items={brief.recommendations} sources={sources} />
        {brief.tradeoffs && brief.tradeoffs.length > 0 ? (
          <>
            <h3 className="brief-subhead">Tradeoffs</h3>
            <BulletList items={brief.tradeoffs} sources={sources} />
          </>
        ) : null}
      </CardShell>
      <CardShell label="Evidence gaps">
        <BulletList items={gaps} sources={sources} />
        {sources.length > 0 ? (
          <div className="brief-source-row">
            {sources.slice(0, 6).map((s) => (
              <SourceChip key={s.id} source={s} />
            ))}
          </div>
        ) : null}
      </CardShell>
    </div>
  );
}

function AnalysisTab({ brief }: { brief: Brief }) {
  return (
    <div className="brief-tab-panel brief-tab-analysis">
      <PsnTabs brief={brief} />
      {brief.psnInteractions && brief.psnInteractions.length > 0 ? (
        <CardShell label="PSN interactions">
          <div className="brief-interactions">
            {brief.psnInteractions.map((psn) => (
              <article key={psn.interaction_id} className="brief-interaction">
                <p className="brief-interaction-main">{psn.causal_interaction}</p>
                <p className="brief-interaction-effect">{psn.decision_effect}</p>
                <div className="brief-interaction-comps">
                  <span className="is-power">Power · {psn.power_component}</span>
                  <span className="is-systems">Systems · {psn.systems_component}</span>
                  <span className="is-narratives">Narratives · {psn.narrative_component}</span>
                </div>
              </article>
            ))}
          </div>
        </CardShell>
      ) : (
        <p className="brief-empty">No PSN interactions recorded.</p>
      )}
    </div>
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
  const [tab, setTab] = useState<BriefDocTab>("confidence");

  return (
    <div className={cn("brief-doc brief-doc-tabbed", className)}>
      <div className="brief-doc-tabs" role="tablist" aria-label="Brief sections">
        {DOC_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`brief-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`brief-panel-${t.id}`}
            className={cn("brief-doc-tab", `is-${t.id}`, tab === t.id && "is-active")}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        className="brief-doc-tabpanels"
        role="tabpanel"
        id={`brief-panel-${tab}`}
        aria-labelledby={`brief-tab-${tab}`}
      >
        {tab === "confidence" ? <ConfidenceTab brief={brief} /> : null}
        {tab === "judgement" ? <JudgementTab brief={brief} sources={sources} /> : null}
        {tab === "analysis" ? <AnalysisTab brief={brief} /> : null}
        {tab === "sources" ? (
          <div className="brief-tab-panel brief-tab-sources">
            <CitedSources sources={sources} />
          </div>
        ) : null}
      </div>

      {footer}
    </div>
  );
}

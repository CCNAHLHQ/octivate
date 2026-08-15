import { existsSync, readFileSync } from "fs";
import path from "path";
import type { ExportTemplate } from "@/lib/types";

/** Minimal starter for newly created templates (styles live in HTML). */
export const BLANK_EXPORT_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{{meta.title}}</title>
</head>
<body>
  <h1>{{brief.title}}</h1>
  <p>{{brief.executiveSummary}}</p>
</body>
</html>`;

/** Branded print-safe brief — used when premade tokenized asset is missing. */
const FALLBACK_OCTIVATE_BRIEF_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{meta.title}}</title>
  <style>
    :root {
      --ink: #070b17;
      --foam: #eaf0ff;
      --plate: #f4f7fc;
      --mist: #475569;
      --faint: #64748b;
      --violet: #8950ee;
      --blue: #4d9df7;
      --coral: #ed6d6c;
      --line: rgba(71, 85, 120, 0.16);
      --line-strong: rgba(71, 85, 120, 0.24);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 0; }
    body {
      font-family: "Instrument Sans", "Segoe UI", system-ui, sans-serif;
      color: var(--ink);
      background: var(--plate);
      line-height: 1.6;
      font-size: 13.5px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .shell {
      position: relative;
      min-height: 100%;
      background:
        radial-gradient(ellipse 80% 50% at 12% -8%, rgba(137, 80, 238, 0.11), transparent 55%),
        radial-gradient(ellipse 70% 45% at 96% 8%, rgba(77, 157, 247, 0.10), transparent 50%),
        radial-gradient(ellipse 60% 40% at 70% 100%, rgba(237, 109, 108, 0.07), transparent 55%),
        linear-gradient(180deg, #ffffff 0%, var(--plate) 48%, #eef2fa 100%);
    }
    .globe {
      position: absolute;
      right: -40px;
      top: 80px;
      width: 340px;
      height: 340px;
      opacity: 0.11;
      pointer-events: none;
      z-index: 0;
    }
    .doc {
      position: relative;
      z-index: 1;
      max-width: 820px;
      margin: 0 auto;
      padding: 40px 36px 56px;
    }
    .doc-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      padding-bottom: 22px;
      border-bottom: 1.5px solid var(--line-strong);
      margin-bottom: 26px;
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand-mark {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: var(--ink);
      display: grid;
      place-items: center;
      flex-shrink: 0;
      box-shadow: 0 8px 20px -12px rgba(7, 11, 23, 0.45);
    }
    .brand-mark svg { width: 30px; height: 26px; display: block; }
    .brand-name {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--ink);
      line-height: 1.1;
    }
    .brand-sub {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.16em;
      color: var(--faint);
      margin-top: 4px;
    }
    .meta-grid {
      display: grid;
      gap: 5px;
      text-align: right;
      font-size: 11px;
      color: var(--mist);
      line-height: 1.45;
    }
    .meta-grid strong { color: var(--ink); font-weight: 650; }
    .kicker {
      font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--violet);
      margin-bottom: 10px;
    }
    h1 {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.2;
      color: var(--ink);
      margin-bottom: 22px;
    }
    section { margin-bottom: 30px; page-break-inside: avoid; }
    h2 {
      font-size: 11px;
      font-weight: 750;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--violet);
      margin-bottom: 14px;
      padding-bottom: 8px;
      border-bottom: 2px solid rgba(137, 80, 238, 0.55);
    }
    .confidence-panel {
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 22px;
      padding: 20px 22px;
      border-radius: 16px;
      border: 1px solid var(--line);
      background:
        linear-gradient(145deg, rgba(137, 80, 238, 0.06), rgba(77, 157, 247, 0.04) 55%, rgba(255,255,255,0.9));
      margin-bottom: 14px;
      page-break-inside: avoid;
    }
    .gauge-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .gauge-wrap .gauge-svg { display: block; }
    .gauge-caption {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--mist);
      text-align: center;
    }
    .stat-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
    .stat {
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.78);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--mist);
    }
    .stat strong {
      display: block;
      font-size: 16px;
      margin-top: 3px;
      letter-spacing: 0;
      text-transform: none;
      color: var(--ink);
      font-weight: 750;
    }
    .stat.risk-high strong, .stat.risk-critical strong { color: var(--coral); }
    .stat.risk-medium strong { color: #d97706; }
    .breakdown { display: grid; gap: 10px; }
    .bar-row {
      display: grid;
      grid-template-columns: 118px 1fr 40px;
      align-items: center;
      gap: 10px;
      font-size: 12px;
    }
    .bar-row .label { color: var(--mist); }
    .bar-row .val { text-align: right; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
    .bar-row .bar-svg { width: 100%; max-width: 220px; height: 14px; display: block; }
    .conf-table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-top: 12px; }
    .conf-table th, .conf-table td {
      border: 1px solid var(--line);
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
      line-height: 1.55;
    }
    .conf-table th {
      background: rgba(137, 80, 238, 0.06);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--mist);
    }
    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .pill.h { background: rgba(22, 163, 74, 0.12); color: #15803d; }
    .pill.m { background: rgba(77, 157, 247, 0.14); color: #1d4ed8; }
    .pill.l { background: rgba(237, 109, 108, 0.14); color: #b91c1c; }
    .summary {
      font-size: 14.5px;
      line-height: 1.7;
      color: var(--ink);
      padding: 18px 20px;
      border-radius: 14px;
      background: rgba(255,255,255,0.82);
      border: 1px solid var(--line);
    }
    .coverage-note {
      font-size: 13px;
      line-height: 1.65;
      color: var(--mist);
      padding: 14px 16px;
      border-radius: 12px;
      background: rgba(77, 157, 247, 0.08);
      border: 1px solid rgba(77, 157, 247, 0.28);
    }
    .list-stack { list-style: none; display: grid; gap: 12px; }
    .list-stack li {
      position: relative;
      padding: 12px 14px 12px 28px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.72);
      font-size: 13px;
      line-height: 1.6;
      page-break-inside: avoid;
    }
    .list-stack li::before {
      content: "";
      position: absolute;
      left: 12px;
      top: 1.15em;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--blue);
    }
    .list-stack.recs li::before { background: var(--violet); }
    .list-stack.gaps li::before { background: var(--coral); }
    .prio {
      display: inline-block;
      margin-left: 6px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--violet);
    }
    .psn-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 14px;
    }
    .psn-col {
      border-radius: 14px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.78);
      padding: 14px 14px 16px;
      page-break-inside: avoid;
    }
    .psn-col h3 {
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid transparent;
      border-image: none;
    }
    .psn-col.power h3 { color: var(--violet); border-bottom-color: var(--violet); }
    .psn-col.systems h3 { color: var(--blue); border-bottom-color: var(--blue); }
    .psn-col.narratives h3 { color: var(--coral); border-bottom-color: var(--coral); }
    .psn-col ul { list-style: none; display: grid; gap: 10px; }
    .psn-col li {
      font-size: 12.5px;
      line-height: 1.6;
      color: var(--ink);
      padding-left: 0;
    }
    .psn-col li + li {
      padding-top: 10px;
      border-top: 1px solid var(--line);
    }
    .ix-stack { display: grid; gap: 16px; }
    .ix-card {
      border-radius: 14px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.86);
      padding: 16px 18px 18px;
      page-break-inside: avoid;
      box-shadow: 0 10px 28px -22px rgba(7, 11, 23, 0.28);
    }
    .ix-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .ix-num {
      font-family: ui-monospace, monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--violet);
      text-transform: uppercase;
    }
    .ix-block { margin-bottom: 12px; }
    .ix-block:last-child { margin-bottom: 0; }
    .ix-label {
      font-size: 10px;
      font-weight: 750;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--faint);
      margin-bottom: 4px;
    }
    .ix-text { font-size: 13px; line-height: 1.65; color: var(--ink); }
    .ix-lenses {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid var(--line);
    }
    .ix-lens {
      border-radius: 10px;
      padding: 10px 11px;
      background: rgba(244, 247, 252, 0.9);
      border: 1px solid var(--line);
    }
    .ix-lens .ix-label { margin-bottom: 6px; }
    .ix-lens.power .ix-label { color: var(--violet); }
    .ix-lens.systems .ix-label { color: var(--blue); }
    .ix-lens.narrative .ix-label { color: var(--coral); }
    .ix-lens .ix-text { font-size: 12px; line-height: 1.55; }
    .source-list { list-style: none; display: grid; gap: 14px; counter-reset: src; }
    .source-list > li {
      counter-increment: src;
      position: relative;
      padding: 14px 16px 14px 42px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.78);
      page-break-inside: avoid;
      line-height: 1.55;
    }
    .source-list > li::before {
      content: counter(src);
      position: absolute;
      left: 12px;
      top: 14px;
      width: 22px;
      height: 22px;
      border-radius: 8px;
      background: rgba(137, 80, 238, 0.12);
      color: var(--violet);
      font-size: 11px;
      font-weight: 800;
      display: grid;
      place-items: center;
    }
    .source-list .title { font-weight: 700; color: var(--ink); }
    .source-list .label-tag {
      display: inline-block;
      margin-right: 6px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--blue);
    }
    .source-list a {
      color: var(--violet);
      word-break: break-all;
      font-size: 11.5px;
      text-decoration: none;
      border-bottom: 1px solid rgba(137, 80, 238, 0.28);
    }
    .source-list .snippet {
      display: block;
      margin-top: 8px;
      font-size: 12.5px;
      color: var(--mist);
      font-style: italic;
      line-height: 1.6;
    }
    .source-list .passages {
      margin-top: 8px;
      display: grid;
      gap: 6px;
    }
    .source-list .passages p {
      font-size: 12px;
      color: var(--mist);
      line-height: 1.55;
      padding-left: 10px;
      border-left: 2px solid rgba(77, 157, 247, 0.45);
    }
    table.findings { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    table.findings th, table.findings td {
      border: 1px solid var(--line);
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
      line-height: 1.55;
    }
    table.findings th {
      background: rgba(77, 157, 247, 0.08);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--mist);
    }
    .footer {
      margin-top: 36px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      font-size: 10px;
      color: var(--faint);
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    .watermark-note { font-style: italic; }
    @media print {
      body { background: #fff; }
      .shell {
        background:
          radial-gradient(ellipse 80% 50% at 12% -8%, rgba(137, 80, 238, 0.09), transparent 55%),
          radial-gradient(ellipse 70% 45% at 96% 8%, rgba(77, 157, 247, 0.08), transparent 50%),
          #fff;
      }
      .ix-card, .psn-col, .list-stack li, .source-list > li, .confidence-panel {
        page-break-inside: avoid;
      }
    }
    @media (max-width: 720px) {
      .confidence-panel, .psn-grid, .ix-lenses { grid-template-columns: 1fr; }
      .doc { padding: 28px 20px 40px; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <svg class="globe" viewBox="0 0 340 340" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="gfill" cx="50%" cy="48%" r="52%">
          <stop offset="0%" stop-color="#4d9df7" stop-opacity="0.35"/>
          <stop offset="55%" stop-color="#8950ee" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#070b17" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="170" cy="170" r="148" fill="url(#gfill)" stroke="#8950ee" stroke-width="1.2"/>
      <ellipse cx="170" cy="170" rx="148" ry="52" fill="none" stroke="#4d9df7" stroke-width="1"/>
      <ellipse cx="170" cy="170" rx="148" ry="96" fill="none" stroke="#8950ee" stroke-width="0.9" opacity="0.7"/>
      <ellipse cx="170" cy="170" rx="52" ry="148" fill="none" stroke="#ed6d6c" stroke-width="1" opacity="0.75"/>
      <ellipse cx="170" cy="170" rx="96" ry="148" fill="none" stroke="#4d9df7" stroke-width="0.85" opacity="0.65"/>
      <circle cx="170" cy="170" r="148" fill="none" stroke="#070b17" stroke-width="1.4" opacity="0.35"/>
      <g fill="#8950ee">
        <circle cx="92" cy="118" r="2.2"/><circle cx="128" cy="86" r="1.8"/>
        <circle cx="170" cy="64" r="2"/><circle cx="214" cy="78" r="1.7"/>
        <circle cx="248" cy="112" r="2.1"/><circle cx="268" cy="156" r="1.6"/>
        <circle cx="256" cy="210" r="2"/><circle cx="220" cy="248" r="1.8"/>
        <circle cx="170" cy="272" r="2.2"/><circle cx="118" cy="252" r="1.7"/>
        <circle cx="82" cy="208" r="2"/><circle cx="74" cy="160" r="1.6"/>
        <circle cx="146" cy="142" r="1.5"/><circle cx="198" cy="134" r="1.5"/>
        <circle cx="186" cy="198" r="1.6"/><circle cx="140" cy="190" r="1.5"/>
      </g>
    </svg>

    <div class="doc">
      <header class="doc-head">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">
            <svg width="30" height="26" viewBox="0 0 88 76" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Octivate">
              <circle cx="28" cy="28" r="26" fill="#ed6d6c" opacity="0.88"/>
              <circle cx="60" cy="28" r="26" fill="#4d9df7" opacity="0.88"/>
              <circle cx="44" cy="52" r="26" fill="#8950ee" opacity="0.88"/>
              <path fill="#ffffff" d="M44 30.5 C45.9 34.4 47.4 36.7 50.4 38.9 C47.4 41.1 45.9 43.4 44 47.3 C42.1 43.4 40.6 41.1 37.6 38.9 C40.6 36.7 42.1 34.4 44 30.5 Z"/>
            </svg>
          </div>
          <div>
            <div class="brand-name">{{meta.brandName}}</div>
            <div class="brand-sub">Decision intelligence brief</div>
          </div>
        </div>
        <div class="meta-grid">
          <div><strong>{{brief.country}}</strong> · {{brief.sector}}</div>
          <div>Pipeline: <strong>{{meta.pipelineLabel}}</strong></div>
          <div>Depth: <strong>{{brief.depthLabel}}</strong> · {{brief.statusLabel}}</div>
          <div>Generated: <strong>{{meta.generatedAtFormatted}}</strong></div>
        </div>
      </header>

      <p class="kicker">{{meta.subject}}</p>
      <h1>{{brief.title}}</h1>

      {{#showRiskSection}}
      <section>
        <h2>Confidence &amp; risk</h2>
        <div class="stat-chips">
          <div class="stat">Confidence<strong>{{brief.confidenceLabel}}</strong></div>
          <div class="stat risk-{{brief.riskLevel}}">Risk<strong>{{brief.riskLabel}}</strong></div>
          <div class="stat">Review<strong>{{brief.reviewLabel}}</strong></div>
        </div>

        <div class="confidence-panel">
          <div class="gauge-wrap">
            {{#showGauge}}{{{gaugeSvg}}}{{/showGauge}}
            <div class="gauge-caption">Overall confidence</div>
          </div>
          <div class="breakdown">
            {{#hasScoreBreakdown}}
            <div class="ix-label" style="margin-bottom:6px">Score breakdown</div>
            {{#scoreParts}}
            <div class="bar-row">
              <span class="label">{{label}}</span>
              {{{barSvg}}}
              <span class="val">{{value}}</span>
            </div>
            {{/scoreParts}}
            {{/hasScoreBreakdown}}

            {{#showRiskBars}}
            {{^hasScoreBreakdown}}<div class="ix-label" style="margin-bottom:6px">Risk factors</div>{{/hasScoreBreakdown}}
            {{#hasScoreBreakdown}}<div class="ix-label" style="margin:12px 0 6px">Risk factors</div>{{/hasScoreBreakdown}}
            {{#riskFactors}}
            <div class="bar-row">
              <span class="label">{{label}}</span>
              {{{barSvg}}}
              <span class="val">{{score}}</span>
            </div>
            {{/riskFactors}}
            {{/showRiskBars}}

            {{#showPsnCoverage}}
            <div class="ix-label" style="margin:12px 0 6px">PSN coverage</div>
            {{#psnCoverage}}
            <div class="bar-row">
              <span class="label">{{label}}</span>
              {{{barSvg}}}
              <span class="val">{{value}}</span>
            </div>
            {{/psnCoverage}}
            {{/showPsnCoverage}}
          </div>
        </div>

        {{#hasConfidenceRows}}
        <table class="conf-table">
          <thead>
            <tr><th>Judgement</th><th>Basis</th><th>Confidence</th></tr>
          </thead>
          <tbody>
            {{#confidenceRows}}
            <tr>
              <td>{{judgment}}</td>
              <td>{{basis}}</td>
              <td><span class="pill {{pillClass}}">{{confidence}}</span></td>
            </tr>
            {{/confidenceRows}}
          </tbody>
        </table>
        {{/hasConfidenceRows}}
      </section>
      {{/showRiskSection}}

      {{#brief.analyticalJudgement}}
      <section>
        <h2>Analytical judgement</h2>
        <div class="summary">{{brief.analyticalJudgement}}</div>
      </section>
      {{/brief.analyticalJudgement}}

      {{#hasEvidenceCoverage}}
      <section>
        <h2>Evidence coverage</h2>
        <div class="coverage-note">{{coverageNote}}</div>
      </section>
      {{/hasEvidenceCoverage}}

      {{#hasRecommendations}}
      <section>
        <h2>Recommendations</h2>
        <ul class="list-stack recs">
          {{#recommendations}}
          <li><strong>{{index}}.</strong> {{text}}<span class="prio">{{priority}}</span></li>
          {{/recommendations}}
        </ul>
      </section>
      {{/hasRecommendations}}

      {{#hasGaps}}
      <section>
        <h2>Evidence gaps</h2>
        <ul class="list-stack gaps">
          {{#gaps}}
          <li>{{text}}</li>
          {{/gaps}}
        </ul>
      </section>
      {{/hasGaps}}

      {{#hasPsn}}
      <section>
        <h2>Power · Systems · Narratives</h2>
        <div class="psn-grid">
          <div class="psn-col power">
            <h3>Power</h3>
            <ul>{{#power}}<li>{{text}}</li>{{/power}}</ul>
          </div>
          <div class="psn-col systems">
            <h3>Systems</h3>
            <ul>{{#systems}}<li>{{text}}</li>{{/systems}}</ul>
          </div>
          <div class="psn-col narratives">
            <h3>Narratives</h3>
            <ul>{{#narratives}}<li>{{text}}</li>{{/narratives}}</ul>
          </div>
        </div>
      </section>
      {{/hasPsn}}

      {{#hasInteractionCards}}
      <section>
        <h2>PSN interactions</h2>
        <div class="ix-stack">
          {{#interactionCards}}
          <article class="ix-card">
            <div class="ix-head">
              <span class="ix-num">Interaction {{index}}</span>
              <span class="pill {{confidenceClass}}">{{confidence}}</span>
            </div>
            {{#causal}}
            <div class="ix-block">
              <div class="ix-label">Causal interaction</div>
              <div class="ix-text">{{causal}}</div>
            </div>
            {{/causal}}
            {{#effect}}
            <div class="ix-block">
              <div class="ix-label">Decision effect</div>
              <div class="ix-text">{{effect}}</div>
            </div>
            {{/effect}}
            <div class="ix-lenses">
              <div class="ix-lens power">
                <div class="ix-label">Power</div>
                <div class="ix-text">{{power}}</div>
              </div>
              <div class="ix-lens systems">
                <div class="ix-label">Systems</div>
                <div class="ix-text">{{systems}}</div>
              </div>
              <div class="ix-lens narrative">
                <div class="ix-label">Narrative</div>
                <div class="ix-text">{{narrative}}</div>
              </div>
            </div>
          </article>
          {{/interactionCards}}
        </div>
      </section>
      {{/hasInteractionCards}}

      {{#tables}}
      <section>
        <h2>{{title}}</h2>
        <table class="findings">
          <thead><tr>{{#headers}}<th>{{.}}</th>{{/headers}}</tr></thead>
          <tbody>{{#rows}}<tr>{{#cells}}<td>{{.}}</td>{{/cells}}</tr>{{/rows}}</tbody>
        </table>
      </section>
      {{/tables}}

      {{#hasCitedSources}}
      <section>
        <h2>Cited sources</h2>
        <ol class="source-list">
          {{#citedSources}}
          <li>
            <span class="label-tag">{{label}}</span>
            <span class="title">{{title}}</span>
            {{#url}}<br /><a href="{{url}}">{{url}}</a>{{/url}}
            {{#snippet}}<span class="snippet">{{snippet}}</span>{{/snippet}}
            {{#hasPassages}}
            <div class="passages">
              {{#passages}}<p>{{text}}</p>{{/passages}}
            </div>
            {{/hasPassages}}
          </li>
          {{/citedSources}}
        </ol>
      </section>
      {{/hasCitedSources}}

      <footer class="footer">
        <span class="watermark-note">{{meta.watermarkText}}</span>
        <span>{{meta.brandName}} · {{meta.generatedAtFormatted}}</span>
      </footer>
    </div>
  </div>
</body>
</html>`;

function loadOctivateBriefHtml(): string {
  const candidates = [
    path.join(
      process.cwd(),
      "data",
      "local",
      "export-assets",
      "tpl_octivate_brief",
      "tokenized-brief.html"
    ),
    path.join(
      process.cwd(),
      ".next",
      "standalone",
      "data",
      "local",
      "export-assets",
      "tpl_octivate_brief",
      "tokenized-brief.html"
    ),
  ];
  for (const file of candidates) {
    try {
      if (existsSync(file)) {
        const html = readFileSync(file, "utf8");
        if (html.includes("{{brief.title}}")) return html;
      }
    } catch {
      /* try next */
    }
  }
  return FALLBACK_OCTIVATE_BRIEF_HTML;
}

const OCTIVATE_BRIEF_HTML = loadOctivateBriefHtml();

export const SEED_EXPORT_TEMPLATES: ExportTemplate[] = [
  {
    id: "tpl_octivate_brief",
    name: "Octivate Decision Brief",
    description:
      "Premade Octivate decision brief design with live Mustache bindings for doctrine data, charts, and monitoring.",
    subjectPreset: "Decision brief",
    campaignSubject: "{{brief.title}} — Octivate intelligence brief",
    htmlBody: OCTIVATE_BRIEF_HTML,
    supportsFormats: ["html", "pdf", "docx", "pptx"],
    sortOrder: 0,
    enabled: true,
    imported: false,
    previewText: "Dynamic doctrine brief — premade design shell",
    createdAt: "2026-07-18T10:00:00Z",
    updatedAt: "2026-08-15T18:00:00Z",
  },
  {
    id: "tpl_executive_summary",
    name: "Executive Summary (compact)",
    description: "One-page summary layout for stakeholder circulation.",
    subjectPreset: "Executive summary",
    campaignSubject: "Executive summary: {{brief.title}}",
    htmlBody: `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>{{brief.title}}</title>
<style>
body{font-family:system-ui,sans-serif;color:#101a2e;padding:40px;line-height:1.6}
h1{font-size:24px;margin-bottom:8px} .sub{color:#475569;margin-bottom:20px}
.box{padding:16px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}
</style></head><body>
<h1>{{brief.title}}</h1>
<p class="sub">{{brief.country}} · {{brief.sector}} · {{meta.generatedAtFormatted}}</p>
<div class="box">{{brief.executiveSummary}}</div>
<h3>Top recommendations</h3>
<ul>{{#recommendations}}<li>{{text}}</li>{{/recommendations}}</ul>
<p style="margin-top:32px;font-size:11px;color:#64748b">{{meta.watermarkText}}</p>
</body></html>`,
    supportsFormats: ["html", "pdf", "docx"],
    sortOrder: 1,
    enabled: true,
    imported: false,
    previewText: "Compact executive layout",
    createdAt: "2026-07-18T10:00:00Z",
    updatedAt: "2026-07-18T10:00:00Z",
  },
];

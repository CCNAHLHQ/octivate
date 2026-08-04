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

/** Compact dynamic fallback if the premade tokenized asset is missing. */
const FALLBACK_OCTIVATE_BRIEF_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{meta.title}}</title>
  <style>
    :root {
      --ink: #101a2e;
      --foam: #f4f7fc;
      --mist: #475569;
      --violet: #9333ea;
      --tide: #0d9488;
      --line: rgba(71, 85, 120, 0.16);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Instrument Sans", system-ui, sans-serif;
      color: var(--ink);
      background: #fff;
      line-height: 1.55;
      font-size: 14px;
    }
    .doc { max-width: 820px; margin: 0 auto; padding: 48px 40px 64px; }
    .doc-head {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 24px; padding-bottom: 24px; border-bottom: 2px solid var(--line);
      margin-bottom: 28px;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-mark {
      width: 42px; height: 42px; border-radius: 12px;
      background: linear-gradient(135deg, var(--violet), var(--tide));
      display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 18px;
    }
    .brand-name { font-size: 22px; font-weight: 800; letter-spacing: -0.03em; }
    .brand-sub { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--mist); }
    .meta-grid { display: grid; gap: 6px; text-align: right; font-size: 11px; color: var(--mist); }
    .meta-grid strong { color: var(--ink); font-weight: 600; }
    h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.15; margin-bottom: 8px; }
    .kicker {
      font-family: ui-monospace, monospace; font-size: 10px; font-weight: 700;
      letter-spacing: 0.16em; text-transform: uppercase; color: var(--violet); margin-bottom: 12px;
    }
    .summary {
      font-size: 15px; line-height: 1.65; color: var(--mist);
      padding: 18px 20px; border-radius: 12px; background: #f8fafc;
      border: 1px solid var(--line); margin: 20px 0 28px;
    }
    .stat-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 28px; }
    .stat {
      padding: 10px 14px; border-radius: 10px; border: 1px solid var(--line);
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em;
    }
    .stat strong { display: block; font-size: 18px; margin-top: 4px; letter-spacing: 0; text-transform: none; }
    section { margin-bottom: 28px; }
    h2 {
      font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
      color: var(--violet); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--line);
    }
    ul { list-style: none; display: grid; gap: 8px; }
    li {
      position: relative; padding-left: 16px; font-size: 13px; line-height: 1.5;
    }
    li::before {
      content: ""; position: absolute; left: 0; top: 0.55em;
      width: 5px; height: 5px; border-radius: 50%; background: var(--tide);
    }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { border: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--mist); }
    .chart-block {
      padding: 16px; border-radius: 12px; border: 1px solid var(--line);
      background: linear-gradient(160deg, rgba(147,51,234,0.04), rgba(13,148,136,0.03));
      margin-bottom: 12px;
    }
    .chart-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--mist); margin-bottom: 10px; }
    .chart-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; font-size: 12px; }
    .chart-bar-track { flex: 1; height: 8px; border-radius: 999px; background: #eef2fa; overflow: hidden; }
    .chart-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--violet), var(--tide)); }
    .footer {
      margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--line);
      font-size: 10px; color: var(--mist); display: flex; justify-content: space-between; gap: 12px;
    }
    .watermark-note { font-style: italic; opacity: 0.85; }
  </style>
</head>
<body>
  <div class="doc">
    <header class="doc-head">
      <div class="brand">
        <div class="brand-mark">O</div>
        <div>
          <div class="brand-name">Octivate</div>
          <div class="brand-sub">Decision intelligence brief</div>
        </div>
      </div>
      <div class="meta-grid">
        <div><strong>{{brief.country}}</strong> · {{brief.sector}}</div>
        <div>Pipeline: <strong>{{meta.pipelineLabel}}</strong></div>
        <div>Generated: <strong>{{meta.generatedAtFormatted}}</strong></div>
      </div>
    </header>

    <p class="kicker">{{meta.subject}}</p>
    <h1>{{brief.title}}</h1>

    <div class="summary">{{brief.executiveSummary}}</div>

    <div class="stat-row">
      <div class="stat">Confidence<strong>{{brief.confidenceLabel}}</strong></div>
      <div class="stat">Risk level<strong>{{brief.riskLabel}}</strong></div>
      <div class="stat">Status<strong>{{brief.status}}</strong></div>
    </div>

    {{#charts}}
    <section>
      <h2>{{title}}</h2>
      <div class="chart-block">
        <div class="chart-title">{{centerLabel}}</div>
        {{#segments}}
        <div class="chart-bar">
          <span style="min-width:90px">{{label}}</span>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:{{percent}}%"></div></div>
          <span>{{value}}</span>
        </div>
        {{/segments}}
      </div>
    </section>
    {{/charts}}

    <section>
      <h2>Recommendations</h2>
      <ul>{{#recommendations}}<li><strong>{{index}}.</strong> {{text}}</li>{{/recommendations}}</ul>
    </section>

    <section>
      <h2>Evidence gaps</h2>
      <ul>{{#gaps}}<li>{{text}}</li>{{/gaps}}</ul>
    </section>

    <section>
      <h2>Power · Systems · Narratives</h2>
      <table>
        <thead><tr><th>Power</th><th>Systems</th><th>Narratives</th></tr></thead>
        <tbody>
          {{#psnRows}}
          <tr><td>{{power}}</td><td>{{systems}}</td><td>{{narratives}}</td></tr>
          {{/psnRows}}
        </tbody>
      </table>
    </section>

    {{#hasCitedSources}}
    <section>
      <h2>Cited sources</h2>
      <ol>
        {{#citedSources}}
        <li>
          <strong>{{label}}</strong> — {{title}}
          {{#url}}<br /><a href="{{url}}">{{url}}</a>{{/url}}
          {{#snippet}}<br /><em>{{snippet}}</em>{{/snippet}}
        </li>
        {{/citedSources}}
      </ol>
    </section>
    {{/hasCitedSources}}

    {{#tables}}
    <section>
      <h2>{{title}}</h2>
      <table>
        <thead><tr>{{#headers}}<th>{{.}}</th>{{/headers}}</tr></thead>
        <tbody>{{#rows}}<tr>{{#cells}}<td>{{.}}</td>{{/cells}}</tr>{{/rows}}</tbody>
      </table>
    </section>
    {{/tables}}

    <footer class="footer">
      <span class="watermark-note">{{meta.watermarkText}}</span>
      <span>Octivate · {{meta.generatedAtFormatted}}</span>
    </footer>
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
    updatedAt: "2026-07-25T19:30:00Z",
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

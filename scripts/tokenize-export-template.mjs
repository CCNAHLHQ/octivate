/**
 * Build Mustache-tokenized Octivate brief HTML from the premade design reference.
 * Source of truth for CSS/logo: design-reference.html (static Guyana design archive).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storePath = path.join(root, "data", "local", "export-templates.json");
const assetDir = path.join(root, "data", "local", "export-assets", "tpl_octivate_brief");
const outCss = path.join(assetDir, "design-styles.css");
const outRef = path.join(assetDir, "design-reference.html");
const outTokenized = path.join(assetDir, "tokenized-brief.html");
const seedOut = path.join(assetDir, "seed-octivate-brief.html");
const legacyExport = path.join(root, "data", "local", "export-output", "exp_mry2zqd7_t39kuu.html");

fs.mkdirSync(assetDir, { recursive: true });

function loadDesignSource() {
  if (fs.existsSync(outRef)) {
    const ref = fs.readFileSync(outRef, "utf8");
    const mustache = (ref.match(/\{\{/g) || []).length;
    const guyana = (ref.match(/Guyana/g) || []).length;
    if (mustache === 0 && guyana > 0 && ref.includes("<style")) return ref;
  }
  if (fs.existsSync(legacyExport)) {
    return fs.readFileSync(legacyExport, "utf8");
  }
  const templates = JSON.parse(fs.readFileSync(storePath, "utf8"));
  return (templates.find((t) => t.id === "tpl_octivate_brief") || templates[0]).htmlBody;
}

const html = loadDesignSource();
fs.writeFileSync(outRef, html, "utf8");

let style = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || "";
const dynIdx = style.indexOf("/* Dynamic export additions");
if (dynIdx >= 0) style = style.slice(0, dynIdx).trimEnd();
fs.writeFileSync(outCss, style + "\n", "utf8");

const logoMatch = html.match(/<img[^>]+src="(data:image\/[^"]+)"[^>]*>/i);
const logoSrc = logoMatch ? logoMatch[1] : "";

const printExtras = `
/* Dynamic export additions — preserve premade palette */
@media print {
  body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { box-shadow: none !important; margin: 0 !important; }
  .rec, .chart-card, .bar-row, .gap, .card, .strip .cell { break-inside: avoid; page-break-inside: avoid; }
}
.bar-row .fill { min-width: 2%; transition: none; }
.bar-row .fill.warn { background: linear-gradient(90deg, #F08A3C, var(--violet)); box-shadow: 0 0 12px rgba(240,138,60,.35); }
.bar-row .fill.ok { background: linear-gradient(90deg, var(--ok, #16a34a), var(--blue)); box-shadow: 0 0 12px rgba(22,163,74,.25); }
.pri.med { background: #EAF6FF; color: #0B6FB8; }
.gauge-dynamic {
  background: conic-gradient(from -90deg at 50% 100%,
    var(--ok) 0deg calc(var(--gauge-pct, 60) * 1.8deg),
    rgba(148, 163, 184, 0.22) calc(var(--gauge-pct, 60) * 1.8deg) 180deg,
    transparent 180deg 360deg) !important;
}
.needle-dynamic {
  transform: translateX(-50%) rotate(var(--needle-deg, 0deg)) !important;
}
.empty-note {
  font-size: 0.92rem;
  color: var(--mist, #64748b);
  font-style: italic;
  padding: 0.6rem 0 0.2rem;
}
.truncated-note {
  font-size: 0.78rem;
  color: var(--mist, #64748b);
  margin-top: 0.55rem;
}
.psn-lists ul { margin: 0; padding-left: 1.1rem; }
.psn-lists li { margin-bottom: 0.45rem; }
`;

const logoTag = logoSrc
  ? `<img src="${logoSrc}" alt="Octivate logo">`
  : `<div style="width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,var(--violet),var(--coral));display:grid;place-items:center;color:#fff;font-weight:800;font-size:1.4rem">O</div>`;

const fixed = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{meta.title}}</title>
  <style>
${style}
${printExtras}
  </style>
</head>
<body>
<div class="page">
  <div class="watermark"></div>
  <div class="content">

    <header class="mast">
      <div class="classbar"><span>{{meta.brandName}} · Decision Intelligence</span><span>{{meta.watermarkText}}</span></div>
      <div class="mast-inner">
        ${logoTag}
        <div>
          <div class="kicker">Decision Intelligence Brief · {{meta.pipelineLabel}}</div>
          <h1>{{brief.title}}</h1>
          <p class="sub">Strategic risk read on <strong>{{brief.country}}</strong> · {{brief.sector}} — generated for authorised decision use.</p>
          <div class="meta-row">
            <div><b>Issued</b>{{meta.generatedAtFormatted}}</div>
            <div><b>Region</b>{{brief.country}}</div>
            <div><b>Sector</b>{{brief.sector}}</div>
            <div><b>Status</b>{{brief.status}}</div>
          </div>
        </div>
      </div>
    </header>

    <div class="strip">
      <div class="cell">
        <div class="lab">Risk Level</div>
        <span class="badge {{brief.riskBadgeClass}}">{{brief.riskLabel}}</span>
        <small>{{meta.pipelineLabel}}</small>
      </div>
      <div class="cell">
        <div class="lab">Confidence</div>
        <span class="badge conf">{{brief.confidenceLabel}}</span>
        <small>Doctrine-weighted assessment; gaps flagged in §6</small>
      </div>
      <div class="cell">
        <div class="lab">Status</div>
        <span class="badge active">{{brief.status}}</span>
        <small>{{#brief.reviewStatus}}Review · {{brief.reviewStatus}}{{/brief.reviewStatus}}{{^brief.reviewStatus}}Active monitoring{{/brief.reviewStatus}}</small>
      </div>
      <div class="cell">
        <div class="lab">Depth</div>
        <span class="badge med">{{#brief.analysisDepth}}{{brief.analysisDepth}}{{/brief.analysisDepth}}{{^brief.analysisDepth}}standard{{/brief.analysisDepth}}</span>
        <small>Pipeline mode · {{meta.pipelineMode}}</small>
      </div>
    </div>
    <div class="divider"><span></span></div>

    <section>
      <div class="sec-head"><span class="sec-tag">01 · Description</span><h2>Situation &amp; Decision Context</h2></div>
      <p>{{brief.executiveSummary}}</p>
      {{#decisionQuestion}}
      <p>The decision this brief supports: <strong>{{decisionQuestion}}</strong></p>
      {{/decisionQuestion}}
      {{#brief.analyticalJudgement}}
      <div class="callout"><p><strong>Bottom line:</strong> {{brief.analyticalJudgement}}</p></div>
      {{/brief.analyticalJudgement}}
    </section>
    <div class="divider"><span></span></div>

    <section>
      <div class="sec-head"><span class="sec-tag">02 · PSN Analysis</span><h2>Power · Systems · Narratives</h2></div>
      {{#hasPsn}}
      <div class="psn psn-lists">
        <div class="card">
          <h3><span class="dot p"></span>Power</h3>
          <ul>{{#power}}<li>{{text}}</li>{{/power}}</ul>
        </div>
        <div class="card">
          <h3><span class="dot s"></span>Systems</h3>
          <ul>{{#systems}}<li>{{text}}</li>{{/systems}}</ul>
        </div>
        <div class="card">
          <h3><span class="dot n"></span>Narratives</h3>
          <ul>{{#narratives}}<li>{{text}}</li>{{/narratives}}</ul>
        </div>
      </div>
      {{/hasPsn}}
      {{^hasPsn}}
      <p class="empty-note">No PSN lens outputs were available for this brief.</p>
      {{/hasPsn}}
    </section>
    <div class="divider"><span></span></div>

    <section>
      <div class="sec-head"><span class="sec-tag">03 · Graphs</span><h2>Risk Quantification</h2></div>
      <div class="charts">
        <div class="chart-card">
          <h3>Risk factor scores (0–10)</h3>
          <div class="note">Octivate composite scoring · evidence-weighted · {{meta.generatedAtFormatted}}</div>
          {{#riskFactors}}
          <div class="bar-row">
            <span class="bl">{{label}}</span>
            <div class="track"><div class="fill {{tone}}" style="width:{{percent}}%"></div></div>
            <span class="val">{{score}}</span>
          </div>
          {{/riskFactors}}
          {{^riskFactors}}
          <p class="empty-note">Insufficient scored factors for a risk bar chart.</p>
          {{/riskFactors}}
          {{#riskFactorsTruncated}}
          <p class="truncated-note">+{{riskFactorsTruncated}} additional factors omitted for layout.</p>
          {{/riskFactorsTruncated}}
        </div>
        <div class="chart-card">
          <h3>PSN coverage</h3>
          <div class="note">Entity counts from doctrine lenses</div>
          {{#psnCoverage}}
          <div class="bar-row">
            <span class="bl">{{label}}</span>
            <div class="track"><div class="fill" style="width:{{percent}}%"></div></div>
            <span class="val">{{value}}</span>
          </div>
          {{/psnCoverage}}
          <div class="gauge-wrap" style="margin-top:1.25rem">
            <div class="gauge gauge-dynamic" style="--gauge-pct: {{brief.confidence}};">
              <div class="needle needle-dynamic" style="--needle-deg: {{needleDeg}}deg;"></div>
            </div>
            <div class="gauge-score">{{brief.confidenceLabel}}</div>
            <div class="gauge-cap">Confidence</div>
          </div>
        </div>
      </div>
    </section>
    <div class="divider"><span></span></div>

    <section>
      <div class="sec-head"><span class="sec-tag">04 · Confidence</span><h2>Evidence &amp; Confidence Assessment</h2></div>
      {{#hasConfidenceRows}}
      <table>
        <thead><tr><th>Judgment</th><th>Basis</th><th>Confidence</th></tr></thead>
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
      {{#hasTradeoffs}}
      <div class="callout" style="margin-top:1rem">
        <p><strong>Tradeoffs</strong></p>
        <ul>{{#tradeoffs}}<li>{{text}}</li>{{/tradeoffs}}</ul>
      </div>
      {{/hasTradeoffs}}
    </section>
    <div class="divider"><span></span></div>

    <section>
      <div class="sec-head"><span class="sec-tag">05 · Recommendations</span><h2>Strategic Options &amp; Actions</h2></div>
      {{#hasRecommendations}}
      <div class="recs">
        {{#recommendations}}
        <div class="rec">
          <div>
            <h3>{{title}}</h3>
            <p>{{text}}</p>
          </div>
          <span class="pri {{priorityClass}}">{{priority}}</span>
        </div>
        {{/recommendations}}
      </div>
      {{#recommendationsTruncated}}
      <p class="truncated-note">+{{recommendationsTruncated}} additional recommendations omitted for layout.</p>
      {{/recommendationsTruncated}}
      {{/hasRecommendations}}
      {{^hasRecommendations}}
      <p class="empty-note">No recommendations were produced for this brief.</p>
      {{/hasRecommendations}}
    </section>
    <div class="divider"><span></span></div>

    <section>
      <div class="sec-head"><span class="sec-tag">06 · Evidence Gaps</span><h2>What We Cannot Yet Verify</h2></div>
      {{#hasGaps}}
      <div class="gaps">
        {{#gaps}}
        <div class="gap">
          <h3>Gap {{index}}</h3>
          <p>{{text}}</p>
          <span class="imp">Material to decision</span>
        </div>
        {{/gaps}}
      </div>
      {{#gapsTruncated}}
      <p class="truncated-note">+{{gapsTruncated}} additional gaps omitted for layout.</p>
      {{/gapsTruncated}}
      {{/hasGaps}}
      {{^hasGaps}}
      <p class="empty-note">No material evidence gaps were flagged.</p>
      {{/hasGaps}}
    </section>
    <div class="divider"><span></span></div>

    <section>
      <div class="sec-head"><span class="sec-tag">07 · Monitoring</span><h2>Indicators Under Watch</h2></div>
      <p style="margin-bottom:1rem">Octivate maintains monitoring on the following triggers; activation prompts an out-of-cycle update to this brief.</p>
      {{#hasMonitoring}}
      <div class="psn" style="grid-template-columns:1fr 1fr">
        <div class="card"><ul>
          {{#monitoring}}
          <li>{{text}}</li>
          {{/monitoring}}
        </ul></div>
      </div>
      {{#monitoringTruncated}}
      <p class="truncated-note">+{{monitoringTruncated}} additional watchpoints omitted for layout.</p>
      {{/monitoringTruncated}}
      {{/hasMonitoring}}
      {{^hasMonitoring}}
      <p class="empty-note">No monitoring indicators were attached to this brief.</p>
      {{/hasMonitoring}}
    </section>

    <footer class="fmeta" style="margin-top:2rem;padding:1.25rem 0;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:1rem;font-size:.78rem;color:var(--mist)">
      <span>{{meta.watermarkText}}</span>
      <span>{{meta.brandName}} · {{meta.generatedAtFormatted}}</span>
    </footer>
  </div>
</div>
</body>
</html>
`;

fs.writeFileSync(outTokenized, fixed, "utf8");
fs.writeFileSync(seedOut, fixed, "utf8");

const templates = JSON.parse(fs.readFileSync(storePath, "utf8"));
const tpl = templates.find((t) => t.id === "tpl_octivate_brief") || templates[0];
tpl.htmlBody = fixed;
tpl.campaignSubject = "{{brief.title}} — Octivate intelligence brief";
tpl.updatedAt = new Date().toISOString();
tpl.previewText = "Dynamic doctrine brief — premade design shell";
tpl.description =
  "Premade Octivate decision brief design with live Mustache bindings for doctrine data, charts, and monitoring.";
fs.writeFileSync(storePath, JSON.stringify(templates, null, 2), "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      archived: outRef,
      refGuyana: (html.match(/Guyana/g) || []).length,
      refMustache: (html.match(/\{\{/g) || []).length,
      tokenized: outTokenized,
      styleLen: style.length,
      htmlLen: fixed.length,
      mustache: (fixed.match(/\{\{/g) || []).length,
      hasLogo: Boolean(logoSrc),
    },
    null,
    2
  )
);

/* One-shot writer for the compact SaaS-grade Octivate brief HTML template. */
const fs = require("fs");
const path = require("path");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{meta.title}}</title>
  <style>
:root{
  --violet:#5B35D6;
  --violet-deep:#3D1FA8;
  --indigo:#1B2559;
  --tide:#0EA5A4;
  --blue:#1A7FD4;
  --coral:#D6454A;
  --ink:#121528;
  --ink-soft:#4A4D66;
  --ink-faint:#7A7E99;
  --canvas:#E6E9F2;
  --paper:#FFFFFF;
  --surface:#F5F6FB;
  --line:#D5DAE8;
  --ok:#0F9F6E;
  --warn:#C98900;
  --glow-v:rgba(91,53,214,.12);
  --glow-t:rgba(14,165,164,.12);
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;
  color:var(--ink);
  background:
    radial-gradient(720px 340px at 0% 0%, var(--glow-v), transparent 60%),
    radial-gradient(640px 300px at 100% 0%, var(--glow-t), transparent 55%),
    var(--canvas);
  line-height:1.55;
  -webkit-font-smoothing:antialiased;
  padding:1.25rem .75rem;
}
.page{
  max-width:980px;margin:0 auto;background:var(--paper);
  border:1px solid var(--line);border-radius:14px;
  box-shadow:0 16px 40px rgba(18,21,40,.08);
  position:relative;overflow:hidden;
}
.watermark{
  position:absolute;inset:-20% -10%;pointer-events:none;z-index:0;opacity:.045;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180' viewBox='0 0 320 180'%3E%3Ctext x='20' y='100' fill='%235B35D6' font-family='Segoe UI,Arial' font-size='28' font-weight='700' transform='rotate(-18 160 90)'%3EOCTIVATE%3C/text%3E%3C/svg%3E");
  background-repeat:repeat;background-size:280px 160px;
}
.content{position:relative;z-index:1}
.divider{
  height:28px;display:flex;align-items:center;justify-content:center;margin:0 1.5rem;
}
.divider::before,.divider::after{
  content:"";flex:1;height:1px;
  background:linear-gradient(90deg,transparent,var(--violet) 40%,var(--tide));
  opacity:.45;
}
.divider::after{background:linear-gradient(90deg,var(--tide),var(--violet) 60%,transparent)}
.divider span{
  width:7px;height:7px;margin:0 .65rem;flex:none;border-radius:2px;rotate:45deg;
  background:linear-gradient(135deg,var(--violet),var(--tide));
}
.mast{
  background:linear-gradient(125deg,var(--indigo) 0%,var(--violet-deep) 48%,var(--blue) 100%);
  color:#fff;position:relative;overflow:hidden;
}
.mast::after{
  content:"";position:absolute;width:280px;height:280px;border-radius:50%;
  background:var(--tide);filter:blur(70px);opacity:.28;right:-80px;top:-140px;
}
.classbar{
  display:flex;justify-content:space-between;align-items:center;gap:1rem;
  font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;font-weight:650;
  padding:.45rem 1.5rem;background:rgba(8,10,28,.42);position:relative;z-index:2;
}
.classbar span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mast-inner{display:flex;gap:1.15rem;align-items:center;padding:1.35rem 1.5rem 1.45rem;position:relative;z-index:2}
.mast img{width:72px;height:72px;object-fit:contain;background:#fff;border-radius:14px;padding:8px;
  box-shadow:0 8px 22px rgba(0,0,0,.28);flex-shrink:0}
.kicker{font-size:.7rem;letter-spacing:.22em;text-transform:uppercase;opacity:.88;margin-bottom:.35rem;font-weight:650}
h1{font-size:1.65rem;line-height:1.2;font-weight:800;letter-spacing:-.015em;overflow-wrap:anywhere}
.sub{margin-top:.45rem;font-size:.92rem;max-width:640px;color:#B8F3EF;font-weight:600}
.meta-row{display:flex;flex-wrap:wrap;gap:.55rem;margin-top:.85rem}
.meta-row>div{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);
  padding:.35rem .65rem;border-radius:8px;font-size:.78rem;min-width:0}
.meta-row b{display:block;font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;opacity:.8;margin-bottom:.08rem}
.strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid var(--line);background:var(--surface)}
.strip .cell{padding:.85rem .85rem;border-right:1px solid var(--line);min-width:0}
.strip .cell:first-child{padding-left:1.5rem}
.strip .cell:last-child{padding-right:1.5rem;border-right:none}
.cell .lab{font-size:.62rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft);font-weight:750;margin-bottom:.3rem}
.badge{display:inline-block;font-weight:750;font-size:.86rem;padding:.28rem .65rem;border-radius:999px;max-width:100%;overflow-wrap:anywhere}
.badge.high{background:#FDEBEB;color:#C4262B;border:1px solid #F6B9BA}
.badge.med{background:#FFF6E0;color:#9A6B00;border:1px solid #F1D488}
.badge.active{background:#EAF6FF;color:#0B6FB8;border:1px solid #ADD9F7}
.badge.conf{background:#E8FBF9;color:#0B7A78;border:1px solid #A9E5E1}
.cell small{display:block;margin-top:.3rem;font-size:.72rem;color:var(--ink-soft);line-height:1.35}
section{padding:1.15rem 1.5rem}
.sec-head{display:flex;align-items:center;gap:.65rem;margin-bottom:.7rem;flex-wrap:wrap}
.sec-tag{
  font-size:.62rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  color:#fff;background:linear-gradient(90deg,var(--violet),var(--tide));
  padding:.28rem .55rem;border-radius:6px;white-space:nowrap;
}
h2{font-size:1.12rem;font-weight:800;letter-spacing:-.01em;color:var(--ink)}
p{margin-bottom:.65rem;color:var(--ink-soft);font-size:.92rem}
p strong{color:var(--ink)}
.callout{
  border-left:3px solid var(--violet);
  background:linear-gradient(90deg,rgba(91,53,214,.07),rgba(14,165,164,.05));
  padding:.75rem .9rem;border-radius:0 10px 10px 0;margin:.7rem 0;
}
.callout p{margin:0;color:var(--ink);font-size:.9rem}
.psn{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.7rem;margin-top:.35rem}
.psn .card{
  border:1px solid var(--line);border-radius:10px;padding:.8rem .85rem;
  background:var(--paper);min-width:0;
}
.psn .card h3{font-size:.88rem;font-weight:800;margin-bottom:.4rem;display:flex;align-items:center;gap:.4rem;width:100%}
.dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.dot.p{background:var(--violet)}.dot.s{background:var(--blue)}.dot.n{background:var(--coral)}
.psn ul{list-style:none;margin:0;padding:0}
.psn li{font-size:.8rem;color:var(--ink-soft);padding:.28rem 0 .28rem .9rem;position:relative;border-bottom:1px dashed var(--line);overflow-wrap:anywhere}
.psn li:last-child{border-bottom:none}
.psn li::before{content:"";position:absolute;left:0;top:.55rem;width:5px;height:5px;border-radius:50%;background:var(--tide)}
.psn-count{margin-left:auto;font-size:.65rem;font-weight:800;color:var(--ink-soft);background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:.1rem .4rem}
.charts{display:grid;grid-template-columns:1.1fr .9fr;gap:.85rem;margin-top:.25rem}
.chart-card{border:1px solid var(--line);border-radius:10px;padding:.9rem;background:var(--paper);min-width:0}
.chart-card h3{font-size:.88rem;font-weight:800;margin-bottom:.15rem}
.chart-card .note{font-size:.7rem;color:var(--ink-faint);margin-bottom:.65rem}
.bar-row{display:grid;grid-template-columns:minmax(90px,150px) minmax(0,1fr) 42px;align-items:center;gap:.55rem;margin:.45rem 0}
.bar-row .bl{font-size:.76rem;color:var(--ink);font-weight:600;overflow-wrap:anywhere}
.bar-visual{min-width:0}
.bar-svg{display:block;width:100%;max-width:200px;height:14px}
.bar-row .val{font-size:.8rem;font-weight:800;text-align:right;font-variant-numeric:tabular-nums}
.gauge-wrap{display:flex;flex-direction:column;align-items:center;gap:.25rem;padding-top:.35rem}
.gauge-svg{display:block;margin:.2rem auto 0}
.gauge-score{font-size:1.45rem;font-weight:900;color:var(--violet-deep)}
.gauge-cap{font-size:.7rem;color:var(--ink-soft)}
.track-css,.gauge-dynamic{display:none!important}
.fill.is-zero,.val.is-zero{opacity:.45}
.recs{display:grid;gap:.55rem;margin-top:.25rem;counter-reset:rec}
.rec{
  counter-increment:rec;display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:.65rem;align-items:start;
  border:1px solid var(--line);border-radius:10px;padding:.7rem .85rem;background:var(--paper);
}
.rec::before{content:counter(rec,decimal-leading-zero);font-size:1.05rem;font-weight:900;color:var(--violet)}
.rec h3{font-size:.9rem;font-weight:800;margin-bottom:.2rem;overflow-wrap:anywhere}
.rec p{margin:0;font-size:.8rem}
.pri{font-size:.6rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:.25rem .5rem;border-radius:999px;white-space:nowrap}
.pri.now{background:#FDEBEB;color:#C4262B}
.pri.q3{background:#FFF6E0;color:#9A6B00}
.pri.watch,.pri.med{background:#E8FBF9;color:#0B7A78}
.gaps{display:grid;grid-template-columns:1fr 1fr;gap:.65rem;margin-top:.25rem}
.gap{border:1px solid #E8C4C6;border-radius:10px;padding:.7rem .8rem;background:#FBF7F7;min-width:0}
.gap h3{font-size:.82rem;font-weight:800;color:var(--violet-deep);margin-bottom:.25rem}
.gap p{font-size:.78rem;margin:0;overflow-wrap:anywhere}
.gap .imp{display:inline-block;margin-top:.4rem;font-size:.6rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--coral)}
table{width:100%;border-collapse:collapse;font-size:.8rem;margin-top:.25rem;border:1px solid var(--line);border-radius:10px;overflow:hidden}
th{font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:#fff;background:linear-gradient(90deg,var(--indigo),var(--violet));text-align:left;padding:.5rem .65rem}
td{padding:.5rem .65rem;border-bottom:1px solid var(--line);color:var(--ink-soft);vertical-align:top;overflow-wrap:anywhere}
tr:last-child td{border-bottom:none}
tr:nth-child(even) td{background:var(--surface)}
td:first-child{color:var(--ink);font-weight:700}
.pill{font-size:.65rem;font-weight:800;padding:.18rem .45rem;border-radius:999px}
.pill.h{background:#E6F7F0;color:#0E7B57}.pill.m{background:#FFF6E0;color:#9A6B00}.pill.l{background:#FDEBEB;color:#C4262B}
.cites{display:grid;gap:.55rem;margin-top:.25rem}
.cite{border:1px solid var(--line);border-radius:10px;padding:.65rem .75rem;background:var(--surface);min-width:0}
.cite strong{font-size:.82rem}
.cite .snip{margin-top:.3rem;font-size:.76rem;color:var(--ink-soft);font-style:italic;overflow-wrap:anywhere}
.cite .pass{margin-top:.35rem;padding:.4rem .5rem;border-left:2px solid var(--tide);background:#fff;font-size:.74rem;color:var(--ink)}
.hl{background:linear-gradient(180deg,rgba(14,165,164,.22),rgba(14,165,164,.1));padding:0 .1em;border-radius:2px}
.empty-note{font-size:.82rem;color:var(--ink-faint);font-style:italic;padding:.35rem 0}
.truncated-note{font-size:.72rem;color:var(--ink-faint);margin-top:.4rem}
.monitor-list{list-style:none;display:grid;gap:.35rem}
.monitor-list li{font-size:.82rem;color:var(--ink-soft);padding:.4rem .65rem;border:1px solid var(--line);border-radius:8px;background:var(--surface);overflow-wrap:anywhere}
footer{
  background:linear-gradient(120deg,var(--indigo),var(--violet-deep) 60%,#2F2AB8);
  color:#fff;padding:1rem 1.5rem;display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;
}
footer .furl{font-weight:800;letter-spacing:.1em;font-size:.82rem}
footer .fmeta{font-size:.72rem;color:rgba(255,255,255,.86);line-height:1.4}
footer .fright{text-align:right;flex-shrink:0}
@media(max-width:840px){
  body{padding:0}
  .page{border-radius:0}
  .strip{grid-template-columns:1fr 1fr}
  .psn,.charts,.gaps{grid-template-columns:1fr}
  .mast-inner{flex-direction:column;align-items:flex-start}
  section,.classbar,footer{padding-left:1rem;padding-right:1rem}
  .divider{margin:0 1rem}
  .strip .cell:first-child,.strip .cell:last-child{padding-left:.85rem;padding-right:.85rem}
  h1{font-size:1.35rem}
  footer{flex-direction:column}
  footer .fright{text-align:left}
  .bar-row{grid-template-columns:90px minmax(0,1fr) 36px}
  .rec{grid-template-columns:32px minmax(0,1fr)}
  .pri{grid-column:2}
}
@media print{
  body{background:#fff;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{box-shadow:none;border-radius:0}
  .rec,.chart-card,.gap,.card,.strip .cell,.cite{break-inside:avoid}
}
  </style>
</head>
<body>
<div class="page">
  <div class="watermark" aria-hidden="true"></div>
  <div class="content">
    <header class="mast">
      <div class="classbar"><span>{{meta.brandName}} · Decision Intelligence</span><span>{{meta.watermarkText}}</span></div>
      <div class="mast-inner">
        <img src="{{meta.logoUrl}}" alt="{{meta.brandName}} logo" width="72" height="72" />
        <div>
          <div class="kicker">Decision Intelligence Brief · {{meta.pipelineLabel}}</div>
          <h1>{{projectName}}</h1>
          <p class="sub">Strategic risk read on <strong>{{brief.country}}</strong> · {{brief.sector}} — prepared by Octivate for authorised decision use.</p>
          <div class="meta-row">
            <div><b>Issued</b>{{meta.generatedAtFormatted}}</div>
            <div><b>Theatre</b>{{projectName}}</div>
            <div><b>Region</b>{{brief.country}}</div>
            <div><b>Sector</b>{{brief.sector}}</div>
          </div>
        </div>
      </div>
    </header>

    <div class="strip">
      <div class="cell">
        <div class="lab">Risk level</div>
        <span class="badge {{brief.riskBadgeClass}}">{{brief.riskLabel}}</span>
        <small>Composite theatre assessment</small>
      </div>
      <div class="cell">
        <div class="lab">Confidence</div>
        <span class="badge conf">{{brief.confidenceLabel}}</span>
        <small>Evidence-weighted · gaps in later sections</small>
      </div>
      <div class="cell">
        <div class="lab">Status</div>
        <span class="badge active">{{brief.statusLabel}}</span>
        <small>{{brief.reviewLabel}}</small>
      </div>
      <div class="cell">
        <div class="lab">Depth</div>
        <span class="badge med">{{brief.depthLabel}}</span>
        <small>{{meta.pipelineLabel}}</small>
      </div>
    </div>
    <div class="divider"><span></span></div>

    <section>
      <div class="sec-head"><span class="sec-tag">01 · Context</span><h2>Situation &amp; Decision Context</h2></div>
      <p>{{brief.executiveSummary}}</p>
      {{#decisionQuestion}}
      <p>Decision this brief supports: <strong>{{decisionQuestion}}</strong></p>
      {{/decisionQuestion}}
      {{#brief.analyticalJudgement}}
      <div class="callout"><p><strong>Bottom line:</strong> {{brief.analyticalJudgement}}</p></div>
      {{/brief.analyticalJudgement}}
    </section>

    {{#hasPsn}}
    <div class="divider"><span></span></div>
    <section>
      <div class="sec-head"><span class="sec-tag">02 · PSN</span><h2>Power · Systems · Narratives</h2></div>
      <div class="psn psn-lists">
        {{#powerCount}}
        <div class="card">
          <h3><span class="dot p"></span>Power <span class="psn-count">{{powerCount}}</span></h3>
          <ul>{{#power}}<li>{{text}}</li>{{/power}}</ul>
        </div>
        {{/powerCount}}
        {{#systemsCount}}
        <div class="card">
          <h3><span class="dot s"></span>Systems <span class="psn-count">{{systemsCount}}</span></h3>
          <ul>{{#systems}}<li>{{text}}</li>{{/systems}}</ul>
        </div>
        {{/systemsCount}}
        {{#narrativesCount}}
        <div class="card">
          <h3><span class="dot n"></span>Narratives <span class="psn-count">{{narrativesCount}}</span></h3>
          <ul>{{#narratives}}<li>{{text}}</li>{{/narratives}}</ul>
        </div>
        {{/narrativesCount}}
      </div>
    </section>
    {{/hasPsn}}

    {{#showRiskSection}}
    <div class="divider"><span></span></div>
    <section>
      <div class="sec-head"><span class="sec-tag">03 · Figures</span><h2>Risk Quantification</h2></div>
      <div class="charts">
        {{#showRiskBars}}
        <div class="chart-card">
          <h3>Risk factor scores (0–10)</h3>
          <div class="note">Evidence-weighted composite · {{meta.generatedAtFormatted}}</div>
          {{#riskFactors}}
          <div class="bar-row">
            <span class="bl">{{label}}</span>
            <div class="bar-visual">{{{barSvg}}}</div>
            <span class="val">{{score}}</span>
          </div>
          {{/riskFactors}}
        </div>
        {{/showRiskBars}}
        {{#showPsnCoverage}}
        <div class="chart-card">
          <h3>PSN coverage</h3>
          <div class="note">Non-zero entity counts only</div>
          {{#psnCoverage}}
          <div class="bar-row">
            <span class="bl">{{label}}</span>
            <div class="bar-visual">{{{barSvg}}}</div>
            <span class="val">{{value}}</span>
          </div>
          {{/psnCoverage}}
          {{#showGauge}}
          <div class="gauge-wrap">
            {{{gaugeSvg}}}
            <div class="gauge-score">{{brief.confidenceLabel}}</div>
            <div class="gauge-cap">Confidence</div>
          </div>
          {{/showGauge}}
        </div>
        {{/showPsnCoverage}}
        {{^showPsnCoverage}}
        {{#showGauge}}
        <div class="chart-card">
          <h3>Confidence</h3>
          <div class="gauge-wrap">
            {{{gaugeSvg}}}
            <div class="gauge-score">{{brief.confidenceLabel}}</div>
            <div class="gauge-cap">Confidence</div>
          </div>
        </div>
        {{/showGauge}}
        {{/showPsnCoverage}}
      </div>
    </section>
    {{/showRiskSection}}

    {{#hasConfidenceRows}}
    <div class="divider"><span></span></div>
    <section>
      <div class="sec-head"><span class="sec-tag">04 · Evidence</span><h2>Evidence &amp; Confidence</h2></div>
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
      {{#hasTradeoffs}}
      <div class="callout" style="margin-top:.75rem">
        <p><strong>Tradeoffs</strong></p>
        <ul>{{#tradeoffs}}<li>{{text}}</li>{{/tradeoffs}}</ul>
      </div>
      {{/hasTradeoffs}}
    </section>
    {{/hasConfidenceRows}}

    {{#hasCitedSources}}
    <div class="divider"><span></span></div>
    <section>
      <div class="sec-head"><span class="sec-tag">Citations</span><h2>Supporting local passages</h2></div>
      <div class="cites">
        {{#citedSources}}
        <div class="cite">
          <strong>{{label}}</strong> — {{title}}
          {{#url}}<div style="font-size:.72rem;margin-top:.15rem"><a href="{{url}}">{{url}}</a></div>{{/url}}
          {{#snippet}}<div class="snip"><span class="hl">{{snippet}}</span></div>{{/snippet}}
          {{#passages}}
          <div class="pass">“{{text}}”</div>
          {{/passages}}
        </div>
        {{/citedSources}}
      </div>
    </section>
    {{/hasCitedSources}}

    {{#hasRecommendations}}
    <div class="divider"><span></span></div>
    <section>
      <div class="sec-head"><span class="sec-tag">05 · Actions</span><h2>Strategic Options &amp; Actions</h2></div>
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
    </section>
    {{/hasRecommendations}}

    {{#hasGaps}}
    <div class="divider"><span></span></div>
    <section>
      <div class="sec-head"><span class="sec-tag">06 · Gaps</span><h2>What We Cannot Yet Verify</h2></div>
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
    </section>
    {{/hasGaps}}

    {{#hasMonitoring}}
    <div class="divider"><span></span></div>
    <section>
      <div class="sec-head"><span class="sec-tag">07 · Watch</span><h2>Indicators Under Watch</h2></div>
      <p style="margin-bottom:.55rem">Triggers that should prompt an out-of-cycle update.</p>
      <ul class="monitor-list">
        {{#monitoring}}
        <li>{{text}}</li>
        {{/monitoring}}
      </ul>
      {{#monitoringTruncated}}
      <p class="truncated-note">+{{monitoringTruncated}} additional watchpoints omitted for layout.</p>
      {{/monitoringTruncated}}
    </section>
    {{/hasMonitoring}}

    <footer>
      <div class="fbrand">
        <div class="furl">{{meta.brandName}}</div>
        <div class="fmeta">{{meta.watermarkText}}</div>
      </div>
      <div class="fmeta fright">
        {{meta.pipelineLabel}} · Issued {{meta.generatedAtFormatted}}<br />
        Confidential — authorised decision use only
      </div>
    </footer>
  </div>
</div>
</body>
</html>
`;

const out = path.join(
  process.cwd(),
  "data/local/export-assets/tpl_octivate_brief/tokenized-brief.html"
);
fs.writeFileSync(out, html, "utf8");
console.log("Wrote", out, html.length, "bytes");

/**
 * Smoke-test: render HTML for two briefs and assert content is brief-specific.
 * Usage: node --import tsx scripts/smoke-export-dynamic.mjs
 * Fallback: invokes via next-less dynamic import of compiled paths is hard;
 * this script uses mustache + local JSON directly mirroring the pipeline.
 */
import fs from "fs";
import path from "path";
import Mustache from "mustache";

const root = process.cwd();
const briefs = JSON.parse(fs.readFileSync(path.join(root, "data/local/briefs.json"), "utf8"));
const projects = JSON.parse(fs.readFileSync(path.join(root, "data/local/projects.json"), "utf8"));
const sessions = JSON.parse(
  fs.readFileSync(path.join(root, "data/local/agent-sessions.json"), "utf8")
);
const templates = JSON.parse(
  fs.readFileSync(path.join(root, "data/local/export-templates.json"), "utf8")
);
const tpl = templates.find((t) => t.id === "tpl_octivate_brief");

function pickTwo() {
  const withContent = briefs.filter(
    (b) => b.executiveSummary && (b.recommendations?.length || b.power?.length)
  );
  const a = withContent[0];
  const b =
    withContent.find((x) => x.country !== a.country || x.id !== a.id) || withContent[1] || a;
  return [a, b];
}

function labelRisk(risk) {
  return risk.charAt(0).toUpperCase() + risk.slice(1);
}

function riskBadgeClass(risk) {
  if (risk === "critical" || risk === "high") return "high";
  if (risk === "medium") return "med";
  return "active";
}

function indexed(items) {
  return (items || []).map((text, i) => ({ index: i + 1, text }));
}

function buildCtx(brief) {
  const project = projects.find((p) => p.id === brief.projectId);
  const session = brief.sessionId
    ? sessions.find((s) => s.id === brief.sessionId)
    : sessions.find((s) => s.briefId === brief.id);
  const confidence = brief.confidence || 0;
  const recs = (brief.recommendations || []).slice(0, 8).map((text, i) => ({
    index: i + 1,
    title: text.split(/[.:]/)[0].slice(0, 72),
    text,
    priority: i === 0 ? "Act now" : i < 3 ? "Near term" : "Watch",
    priorityClass: i === 0 ? "now" : i < 3 ? "q3" : "watch",
  }));
  const power = indexed(brief.power);
  const systems = indexed(brief.systems);
  const narratives = indexed(brief.narratives);
  const gaps = indexed([...(brief.gaps || []), ...(brief.evidenceGaps || [])].slice(0, 8));
  return {
    meta: {
      title: brief.title,
      subject: brief.title,
      generatedAtFormatted: new Date().toLocaleString(),
      pipelineMode: brief.pipelineMode || "doctrine",
      pipelineLabel: "Live · Doctrine v0.2",
      watermarkText: "Octivate — Confidential",
      brandName: "Octivate",
    },
    email: { address: "" },
    brief: {
      ...brief,
      riskLabel: labelRisk(brief.riskLevel || "medium"),
      confidenceLabel: `${confidence}%`,
      riskBadgeClass: riskBadgeClass(brief.riskLevel || "medium"),
    },
    decisionQuestion: session?.question || project?.question || brief.title,
    needleDeg: Math.round(-90 + (confidence / 100) * 180),
    recommendations: recs,
    gaps,
    tradeoffs: indexed(brief.tradeoffs || []),
    monitoring: indexed((brief.gaps || []).slice(0, 6)),
    power,
    systems,
    narratives,
    psnRows: [],
    riskFactors: [
      {
        label: "Composite risk",
        score: "6.5",
        percent: 65,
        tone: "warn",
      },
    ],
    psnCoverage: [
      { label: "Power", value: power.length, percent: Math.min(power.length * 15, 100) },
      { label: "Systems", value: systems.length, percent: Math.min(systems.length * 15, 100) },
      {
        label: "Narratives",
        value: narratives.length,
        percent: Math.min(narratives.length * 15, 100),
      },
    ],
    confidenceRows: [
      {
        judgment: brief.executiveSummary.slice(0, 120),
        basis: `${brief.country} · ${brief.sector}`,
        confidence: "moderate",
        pillClass: "m",
      },
    ],
    hasRecommendations: recs.length > 0,
    hasGaps: gaps.length > 0,
    hasCharts: true,
    hasPsn: power.length + systems.length + narratives.length > 0,
    hasMonitoring: true,
    hasTradeoffs: (brief.tradeoffs || []).length > 0,
    hasConfidenceRows: true,
    recommendationsTruncated: 0,
    gapsTruncated: 0,
    riskFactorsTruncated: 0,
    monitoringTruncated: 0,
  };
}

const [a, b] = pickTwo();
const outDir = path.join(root, "data/local/export-output");
fs.mkdirSync(outDir, { recursive: true });

for (const brief of [a, b]) {
  const ctx = buildCtx(brief);
  const rendered = Mustache.render(tpl.htmlBody, ctx);
  const safe = brief.id.replace(/[^a-z0-9_-]/gi, "_");
  const out = path.join(outDir, `smoke_dynamic_${safe}.html`);
  fs.writeFileSync(out, rendered, "utf8");
  const hasTitle = rendered.includes(brief.title);
  const hasCountry = rendered.includes(brief.country);
  const hasGuyanaBleed =
    brief.country !== "Guyana" && rendered.includes("Guyana Midstream LNG");
  const hasTokens = rendered.includes("{{");
  console.log(
    JSON.stringify({
      briefId: brief.id,
      country: brief.country,
      title: brief.title.slice(0, 60),
      out,
      len: rendered.length,
      hasTitle,
      hasCountry,
      hasGuyanaBleed,
      leftoverTokens: hasTokens,
      ok: hasTitle && hasCountry && !hasGuyanaBleed && !hasTokens,
    })
  );
}

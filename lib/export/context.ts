import type { AgentSession, Brief, ExportTemplate, MaterialFinding, Project } from "@/lib/types";

export type ExportChartSegment = {
  label: string;
  value: number;
  percent: number;
  color?: string;
  /** True when value is zero — template suppresses min-width bar fill. */
  isZero?: boolean;
  /** Pre-rendered SVG bar — survives DOCX/PPTX where CSS width fills are dropped. */
  barSvg?: string;
};

export type ExportChart = {
  id: string;
  type: "bar" | "donut" | "gauge";
  title: string;
  centerLabel?: string;
  segments: ExportChartSegment[];
};

export type ExportTable = {
  id: string;
  title: string;
  headers: string[];
  rows: { cells: string[] }[];
};

export type ExportRecommendation = {
  index: number;
  title: string;
  text: string;
  priority: string;
  priorityClass: string;
};

export type ExportRiskFactor = {
  label: string;
  score: string;
  percent: number;
  /** CSS modifier for .fill — premade supports .hot; warn/ok added in template extras */
  tone: "hot" | "warn" | "ok" | "";
  isZero?: boolean;
  fillColor: string;
  /** Pre-rendered SVG bar — survives DOCX/PPTX where CSS width fills are dropped. */
  barSvg: string;
};

export type ExportIndexedText = { index: number; text: string };

/** Full-text PSN interaction for card-stack export layouts (not cramped tables). */
export type ExportInteractionCard = {
  index: number;
  causal: string;
  effect: string;
  power: string;
  systems: string;
  narrative: string;
  confidence: string;
  confidenceClass: string;
};

/** Weighted confidence score breakdown bars. */
export type ExportScorePart = {
  key: string;
  label: string;
  value: string;
  percent: number;
  barSvg: string;
};

export type ExportDocumentContext = {
  meta: {
    title: string;
    subject: string;
    generatedAt: string;
    generatedAtFormatted: string;
    pipelineMode: string;
    pipelineLabel: string;
    logoUrl: string;
    watermarkText: string;
    brandName: string;
  };
  email: { address: string };
  brief: Brief & {
    riskLabel: string;
    confidenceLabel: string;
    riskBadgeClass: string;
    statusLabel: string;
    depthLabel: string;
    reviewLabel: string;
  };
  project?: Project;
  session?: AgentSession;
  decisionQuestion: string;
  projectName: string;
  confidenceDeg: number;
  needleDeg: number;
  /** SVG semicircle gauge — DOCX/PPTX-safe alternative to CSS conic-gradient. */
  gaugeSvg: string;
  recommendations: ExportRecommendation[];
  gaps: ExportIndexedText[];
  tradeoffs: ExportIndexedText[];
  monitoring: ExportIndexedText[];
  power: ExportIndexedText[];
  systems: ExportIndexedText[];
  narratives: ExportIndexedText[];
  powerCount: number;
  systemsCount: number;
  narrativesCount: number;
  psnRows: { power: string; systems: string; narratives: string }[];
  /** Full-text interaction cards — prefer over 5-column tables. */
  interactionCards: ExportInteractionCard[];
  riskFactors: ExportRiskFactor[];
  /** Score breakdown parts from ScoringPolicy (when present). */
  scoreParts: ExportScorePart[];
  psnCoverage: ExportChartSegment[];
  charts: ExportChart[];
  tables: ExportTable[];
  confidenceRows: {
    judgment: string;
    basis: string;
    confidence: string;
    pillClass: string;
  }[];
  hasRecommendations: boolean;
  hasGaps: boolean;
  hasCharts: boolean;
  showRiskSection: boolean;
  showRiskBars: boolean;
  showPsnCoverage: boolean;
  showGauge: boolean;
  hasPsn: boolean;
  hasMonitoring: boolean;
  hasTradeoffs: boolean;
  hasConfidenceRows: boolean;
  hasInteractionCards: boolean;
  hasScoreBreakdown: boolean;
  hasCitedSources: boolean;
  hasEvidenceCoverage: boolean;
  evidenceCoverage: Brief["evidenceCoverage"] | null;
  coverageNote: string;
  citedSources: {
    label: string;
    title: string;
    url: string;
    snippet: string;
    passageCount: number;
    hasPassages: boolean;
    passages: { text: string }[];
  }[];
  recommendationsTruncated: number;
  gapsTruncated: number;
  riskFactorsTruncated: number;
  monitoringTruncated: number;
};

/** Brand palette — matches landing / workspace tokens. */
const BRAND = {
  violet: "#8950ee",
  blue: "#4d9df7",
  coral: "#ed6d6c",
  ink: "#070b17",
  track: "#EEF1F7",
  trackStroke: "#D8DEE9",
} as const;

const MAX_RECS = 12;
const MAX_GAPS = 16;
const MAX_RISK = 10;
const MAX_MONITOR = 10;

function labelRisk(risk: Brief["riskLevel"]) {
  if (!risk || risk === "unassessed") return "Unassessed";
  return risk.charAt(0).toUpperCase() + risk.slice(1);
}

function riskBadgeClass(risk: Brief["riskLevel"]) {
  if (risk === "critical" || risk === "high") return "high";
  if (risk === "medium") return "med";
  if (risk === "unassessed") return "neutral";
  return "active";
}

function pipelineLabel(mode?: string) {
  if (mode === "interactive") return "Live · Interactive";
  if (mode === "doctrine" || mode === "live") return "Live · Doctrine v0.2";
  if (mode === "mock") return "Mock";
  return mode ? String(mode) : "Live · Doctrine v0.2";
}

function indexed(items: string[]): ExportIndexedText[] {
  return items.map((text, i) => ({ index: i + 1, text }));
}

function truncateList<T>(items: T[], max: number): { items: T[]; truncated: number } {
  if (items.length <= max) return { items, truncated: 0 };
  return { items: items.slice(0, max), truncated: items.length - max };
}

function titleFromText(text: string | undefined | null): string {
  const t = String(text || "").trim();
  if (!t) return "Recommendation";
  const clause = t.split(/[.:—–-]/)[0]?.trim() || t;
  return clause.length > 72 ? `${clause.slice(0, 71)}…` : clause;
}

/** Doctrine briefs may store lens rows as MaterialFinding or a narrative-shaped object. */
function findingText(f: MaterialFinding | Record<string, unknown>): string {
  const row = f as Record<string, unknown>;
  return String(
    row.finding || row.narrative || row.decision_effect || row.statement || ""
  ).trim();
}

function findingConfidence(f: MaterialFinding | Record<string, unknown>): string {
  const row = f as Record<string, unknown>;
  return String(row.confidence || "moderate");
}

function priorityForIndex(i: number): { priority: string; priorityClass: string } {
  if (i === 0) return { priority: "Act now", priorityClass: "now" };
  if (i === 1 || i === 2) return { priority: "Near term", priorityClass: "q3" };
  return { priority: "Monitor", priorityClass: "watch" };
}

/** Map machine / opaque indicator strings to operator-readable watchpoints. */
function humanizeIndicator(raw: string): string {
  const t = String(raw || "").trim();
  if (!t) return t;
  const map: Record<string, string> = {
    not_now: "Hold — conditions not ready to act",
    keep_trim: "Keep scope tight — avoid expanding the brief",
    psn_interactions_unavailable: "Watch for evidence of Power–Systems–Narrative interactions",
    insufficient_evidence: "Watch for new on-scope evidence that closes coverage gaps",
    review_pending: "Awaiting operator review before decisions lock",
    pending_review: "Awaiting operator review before decisions lock",
  };
  const key = t.toLowerCase().replace(/\s+/g, "_");
  if (map[key]) return map[key];
  if (/^[a-z0-9_:-]+$/i.test(t) && t.includes("_")) {
    return t
      .replace(/[_:-]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return t;
}

function humanStatusLabel(status?: string): string {
  const s = String(status || "draft").toLowerCase();
  if (s === "final") return "Final";
  if (s === "draft") return "Draft — review open";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanDepthLabel(depth?: string): string {
  const d = String(depth || "standard").toLowerCase();
  if (d === "deep_dive") return "Deep dive";
  if (d === "quick") return "Quick scan";
  if (d === "standard") return "Standard";
  return d.replace(/_/g, " ");
}

function confidenceToPill(c: string): string {
  const n = c.toLowerCase();
  if (n.includes("high")) return "h";
  if (n.includes("moderate") || n.includes("medium") || n.includes("plausible")) return "m";
  return "l";
}

function findingScore(f: MaterialFinding | Record<string, unknown>): number {
  const map: Record<string, number> = {
    high: 8.5,
    moderate: 6.5,
    low: 4.5,
    plausible_unverified: 3.5,
    insufficient_evidence: 2.5,
  };
  return map[findingConfidence(f)] ?? 5;
}

const TONE_FILL: Record<"hot" | "warn" | "ok" | "", string> = {
  hot: BRAND.coral,
  warn: "#F08A3C",
  ok: "#16a34a",
  "": BRAND.violet,
};

/** Explicit-geometry bar so html-to-docx / PPTX keep scored widths. */
function renderBarSvg(percent: number, color: string): string {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const fillW = Math.max(pct <= 0 ? 0 : 2, Math.round((pct / 100) * 220));
  return [
    `<svg class="bar-svg" width="220" height="18" viewBox="0 0 220 18" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${pct}%">`,
    `<rect x="0" y="0" width="220" height="18" rx="9" fill="${BRAND.track}" stroke="${BRAND.trackStroke}"/>`,
    pct > 0
      ? `<rect x="0" y="0" width="${fillW}" height="18" rx="9" fill="${color}"/>`
      : "",
    `</svg>`,
  ].join("");
}

function renderGaugeSvg(confidence: number, needleDeg: number): string {
  const pct = Math.max(0, Math.min(100, Math.round(confidence)));
  const r = 90;
  const arcLen = Math.PI * r;
  const filled = ((pct / 100) * arcLen).toFixed(1);
  // Needle angle: -90 (left / 0%) → +90 (right / 100%), matching CSS needleDeg.
  const tipX = 105 + 78 * Math.sin((needleDeg * Math.PI) / 180);
  const tipY = 105 - 78 * Math.cos((needleDeg * Math.PI) / 180);
  const arcColor =
    pct >= 70 ? "#16a34a" : pct >= 45 ? BRAND.blue : BRAND.coral;
  return [
    `<svg class="gauge-svg" width="210" height="120" viewBox="0 0 210 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Confidence ${pct}%">`,
    `<path d="M15 105 A90 90 0 0 1 195 105" fill="none" stroke="${BRAND.track}" stroke-width="18" stroke-linecap="round"/>`,
    `<path d="M15 105 A90 90 0 0 1 195 105" fill="none" stroke="${arcColor}" stroke-width="18" stroke-linecap="round" stroke-dasharray="${filled} ${arcLen.toFixed(1)}"/>`,
    `<line x1="105" y1="105" x2="${tipX.toFixed(1)}" y2="${tipY.toFixed(1)}" stroke="${BRAND.ink}" stroke-width="3" stroke-linecap="round"/>`,
    `<circle cx="105" cy="105" r="6" fill="${BRAND.ink}"/>`,
    `<text x="105" y="98" text-anchor="middle" font-size="22" font-weight="800" fill="${BRAND.ink}">${pct}%</text>`,
    `</svg>`,
  ].join("");
}

function buildRecommendations(brief: Brief) {
  const raw = (brief.recommendations || []).map((text, i) => {
    const { priority, priorityClass } = priorityForIndex(i);
    return {
      index: i + 1,
      title: titleFromText(text),
      text,
      priority,
      priorityClass,
    };
  });
  return truncateList(raw, MAX_RECS);
}

function buildGaps(brief: Brief) {
  const merged = [
    ...(brief.gaps || []),
    ...(brief.evidenceGaps || []),
  ].filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const g of merged) {
    const text = String(g || "").trim();
    const key = text.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(text);
  }
  const { items, truncated } = truncateList(unique, MAX_GAPS);
  return { items: indexed(items), truncated };
}

function buildMonitoring(brief: Brief) {
  const fromFindings = [
    ...(brief.structuredFindings?.power || []),
    ...(brief.structuredFindings?.systems || []),
    ...(brief.structuredFindings?.narratives || []),
  ].flatMap((f) => {
    const row = f as MaterialFinding & { fracture_indicators?: string };
    const indicators = row.monitoring_indicators || [];
    if (indicators.length) return indicators;
    return row.fracture_indicators ? [row.fracture_indicators] : [];
  });

  const fallback = [
    ...(brief.reviewFlags || []),
    ...(brief.gaps || []).slice(0, 3),
  ];

  const merged = [...fromFindings, ...fallback].filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const m of merged) {
    const text = String(m || "").trim();
    const key = text.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(text);
  }
  const humanized = unique.map(humanizeIndicator);
  const { items, truncated } = truncateList(humanized, MAX_MONITOR);
  return { items: indexed(items), truncated };
}

function buildRiskFactors(brief: Brief): { items: ExportRiskFactor[]; truncated: number } {
  const riskBase: Record<Brief["riskLevel"], number> = {
    unassessed: 0,
    low: 3.2,
    medium: 5.5,
    high: 7.2,
    critical: 8.8,
  };

  const factors: ExportRiskFactor[] = [];

  const findings = [
    ...(brief.structuredFindings?.power || []).map((f) => ({
      label: `Power · ${titleFromText(findingText(f))}`,
      score: findingScore(f),
    })),
    ...(brief.structuredFindings?.systems || []).map((f) => ({
      label: `Systems · ${titleFromText(findingText(f))}`,
      score: findingScore(f),
    })),
    ...(brief.structuredFindings?.narratives || []).map((f) => ({
      label: `Narratives · ${titleFromText(findingText(f))}`,
      score: findingScore(f),
    })),
  ].filter((f) => f.label.replace(/^(Power|Systems|Narratives) · /, "").trim());

  for (const f of findings) {
    const score = Math.max(0, Math.min(10, f.score));
    const percent = Math.round(score * 10);
    const tone: ExportRiskFactor["tone"] =
      score >= 7 ? "hot" : score >= 4.5 ? "warn" : "ok";
    const fillColor = TONE_FILL[tone];
    factors.push({
      label: f.label.slice(0, 120),
      score: score.toFixed(1),
      percent,
      tone,
      isZero: percent <= 0,
      fillColor,
      barSvg: renderBarSvg(percent, fillColor),
    });
  }

  if (!factors.length) {
    const psnCount =
      (brief.power?.length || 0) +
      (brief.systems?.length || 0) +
      (brief.narratives?.length || 0);
    // Only invent composite bars when there is real signal — never emit empty diagrams.
    if (psnCount === 0 && !(brief.confidence > 0)) {
      return { items: [], truncated: 0 };
    }

    const densityScore =
      psnCount > 0 ? Math.min(10, Math.round(psnCount * (10 / 6) * 10) / 10) : 0;
    const invConf = Math.max(1, 10 - (brief.confidence || 0) / 10);

    const pushFactor = (
      label: string,
      score: number,
      tone: ExportRiskFactor["tone"]
    ) => {
      if (score <= 0) return;
      const percent = Math.round(score * 10);
      const fillColor = TONE_FILL[tone];
      factors.push({
        label,
        score: score.toFixed(1),
        percent,
        tone,
        isZero: percent <= 0,
        fillColor,
        barSvg: renderBarSvg(percent, fillColor),
      });
    };

    pushFactor(
      "Composite political-regulatory risk",
      riskBase[brief.riskLevel],
      brief.riskLevel === "unassessed"
        ? "ok"
        : brief.riskLevel === "low"
          ? "ok"
          : brief.riskLevel === "medium"
            ? "warn"
            : "hot"
    );
    if (brief.confidence > 0) {
      pushFactor(
        "Evidence confidence pressure",
        invConf,
        brief.confidence >= 70 ? "ok" : brief.confidence >= 50 ? "warn" : "hot"
      );
    }
    if (densityScore > 0) {
      pushFactor(
        "PSN coverage density",
        densityScore,
        densityScore >= 7 ? "ok" : densityScore >= 3.5 ? "warn" : "hot"
      );
    }
  }

  // Drop zero-score factors so export figures stay honest.
  const nonzero = factors.filter((f) => !f.isZero && Number(f.score) > 0);
  return truncateList(nonzero, MAX_RISK);
}

function buildPsnRows(brief: Brief) {
  const max = Math.max(brief.power.length, brief.systems.length, brief.narratives.length);
  if (max === 0) return [];
  return Array.from({ length: max }, (_, i) => ({
    power: brief.power[i] ?? "—",
    systems: brief.systems[i] ?? "—",
    narratives: brief.narratives[i] ?? "—",
  }));
}

/** Scale entity counts to bar width without inventing coverage for empty lenses. */
function coveragePercent(count: number, scaleMax: number): number {
  if (count <= 0) return 0;
  return Math.min(100, Math.round((count / Math.max(scaleMax, 1)) * 100));
}

function buildCharts(brief: Brief): ExportChart[] {
  const confidence = brief.confidence;
  const riskMap: Record<Brief["riskLevel"], number> = {
    unassessed: 0,
    low: 25,
    medium: 50,
    high: 75,
    critical: 95,
  };

  const powerN = brief.power.length;
  const systemsN = brief.systems.length;
  const narrativesN = brief.narratives.length;
  const scaleMax = Math.max(powerN, systemsN, narrativesN, 4);

  const charts: ExportChart[] = [];

  if (confidence > 0 || brief.recommendations.length > 0) {
    charts.push({
      id: "confidence",
      type: "gauge",
      title: "Confidence & risk profile",
      centerLabel: "Assessment mix",
      segments: [
        { label: "Confidence", value: confidence, percent: confidence, color: BRAND.violet },
        {
          label: "Risk index",
          value: riskMap[brief.riskLevel],
          percent: riskMap[brief.riskLevel],
          color: BRAND.coral,
        },
        ...(brief.recommendations.length
          ? [
              {
                label: "Recommendations",
                value: brief.recommendations.length,
                percent: Math.min(brief.recommendations.length * 20, 100),
                color: BRAND.blue,
              },
            ]
          : []),
      ],
    });
  }

  const psnSegs = (
    [
      {
        label: "Power",
        value: powerN,
        percent: coveragePercent(powerN, scaleMax),
        color: BRAND.violet,
        isZero: powerN === 0,
      },
      {
        label: "Systems",
        value: systemsN,
        percent: coveragePercent(systemsN, scaleMax),
        color: BRAND.blue,
        isZero: systemsN === 0,
      },
      {
        label: "Narratives",
        value: narrativesN,
        percent: coveragePercent(narrativesN, scaleMax),
        color: BRAND.coral,
        isZero: narrativesN === 0,
      },
    ] as ExportChartSegment[]
  )
    .filter((seg) => !seg.isZero && seg.value > 0)
    .map((seg) => ({
      ...seg,
      barSvg: renderBarSvg(seg.percent, seg.color || BRAND.violet),
    }));

  if (psnSegs.length) {
    charts.push({
      id: "psn-counts",
      type: "bar",
      title: "PSN coverage",
      centerLabel: "Entity counts",
      segments: psnSegs,
    });
  }

  return charts;
}

function buildConfidenceRows(brief: Brief) {
  const findings = [
    ...(brief.structuredFindings?.power || []),
    ...(brief.structuredFindings?.systems || []),
    ...(brief.structuredFindings?.narratives || []),
  ].slice(0, 8);

  if (findings.length) {
    return findings.map((f) => {
      const conf = findingConfidence(f);
      const row = f as MaterialFinding;
      return {
        judgment: findingText(f) || "Finding",
        basis: String(
          row.materiality_justification ||
            row.decision_effect ||
            row.judgement_type ||
            "doctrine lens"
        ),
        confidence: conf.replace(/_/g, " "),
        pillClass: confidenceToPill(conf),
      };
    });
  }

  const judgment =
    brief.analyticalJudgement?.trim() ||
    brief.executiveSummary?.trim() ||
    "Judgement pending operator review.";

  return [
    {
      judgment,
      basis: `${brief.country} · ${brief.sector}`,
      confidence: brief.confidence >= 75 ? "high" : brief.confidence >= 55 ? "moderate" : "low",
      pillClass: brief.confidence >= 75 ? "h" : brief.confidence >= 55 ? "m" : "l",
    },
  ];
}

function buildInteractionCards(brief: Brief): ExportInteractionCard[] {
  const rows = brief.psnInteractions || [];
  return rows.map((row, i) => {
    const conf = String(row.confidence || "moderate");
    return {
      index: i + 1,
      causal: String(row.causal_interaction || "").trim(),
      effect: String(row.decision_effect || "").trim(),
      power: String(row.power_component || "").trim(),
      systems: String(row.systems_component || "").trim(),
      narrative: String(row.narrative_component || "").trim(),
      confidence: conf.replace(/_/g, " "),
      confidenceClass: confidenceToPill(conf),
    };
  });
}

function buildScoreParts(brief: Brief): ExportScorePart[] {
  const breakdown = brief.scoreBreakdown;
  if (!breakdown?.parts) return [];

  const labels: { key: keyof typeof breakdown.parts; label: string; color: string }[] = [
    { key: "sourceScore", label: "Source quality", color: BRAND.violet },
    { key: "labelMatch", label: "Label match", color: BRAND.blue },
    { key: "agentConf", label: "Agent confidence", color: BRAND.violet },
    { key: "triangulation", label: "Triangulation", color: BRAND.blue },
    { key: "freshness", label: "Freshness", color: BRAND.coral },
  ];

  return labels.map(({ key, label, color }) => {
    const raw = Math.max(0, Math.round(Number(breakdown.parts[key] ?? 0)));
    const percent = Math.max(0, Math.min(100, raw));
    return {
      key,
      label,
      value: String(raw),
      percent,
      barSvg: renderBarSvg(percent, color),
    };
  });
}

/** Prefer full grounded passages; keep a generous snippet for print fidelity. */
function buildCoverageNote(brief: Brief): { hasEvidenceCoverage: boolean; coverageNote: string; evidenceCoverage: Brief["evidenceCoverage"] | null } {
  const cov = brief.evidenceCoverage;
  if (!cov) {
    return { hasEvidenceCoverage: false, coverageNote: "", evidenceCoverage: null };
  }
  const skipped = cov.skippedDocIds?.length ?? 0;
  const hasEvidenceCoverage = skipped > 0 || Boolean(cov.truncated);
  if (!hasEvidenceCoverage) {
    return { hasEvidenceCoverage: false, coverageNote: "", evidenceCoverage: cov };
  }
  if (cov.note?.trim()) {
    return { hasEvidenceCoverage: true, coverageNote: cov.note.trim(), evidenceCoverage: cov };
  }
  const parts = [
    `Included ${cov.includedDocs} of ${cov.totalDocs} documents (${cov.charCount.toLocaleString()} / ${cov.charBudget.toLocaleString()} chars).`,
  ];
  if (skipped > 0) {
    parts.push(`${skipped} document(s) excluded from the packed evidence window.`);
  }
  if (cov.truncated) {
    parts.push("Evidence packing was truncated to the character budget.");
  }
  return { hasEvidenceCoverage: true, coverageNote: parts.join(" "), evidenceCoverage: cov };
}

function buildCitedSources(brief: Brief) {
  return (brief.citedSources || []).map((s) => {
    const passages = (s.passages || [])
      .map((p) => ({ text: String(p.text || "").trim() }))
      .filter((p) => p.text)
      .slice(0, 8);
    const snippet = String(
      s.snippet || passages[0]?.text || ""
    ).trim();
    return {
      label: s.label,
      title: s.title,
      url: s.url || "",
      snippet,
      passageCount: s.passageCount ?? passages.length,
      hasPassages: passages.length > 0,
      passages,
    };
  });
}

function buildFindingsTable(brief: Brief): ExportTable | null {
  const findings = brief.structuredFindings;
  if (!findings) return null;

  const rows = [
    ...findings.power.map((f) => ["Power", findingText(f), findingConfidence(f)]),
    ...findings.systems.map((f) => ["Systems", findingText(f), findingConfidence(f)]),
    ...findings.narratives.map((f) => [
      "Narratives",
      findingText(f),
      findingConfidence(f),
    ]),
  ].filter((r) => r[1]);

  if (!rows.length) return null;

  return {
    id: "structured-findings",
    title: "Structured findings",
    headers: ["Domain", "Finding", "Confidence"],
    rows: rows.map((cells) => ({ cells })),
  };
}

function resolveSubject(template: ExportTemplate | undefined, brief: Brief) {
  const raw =
    template?.campaignSubject ||
    template?.subjectPreset ||
    "Decision intelligence brief";
  return raw
    .replace(/\{\{\s*brief\.title\s*\}\}/g, brief.title)
    .replace(/\{\{\s*email\.address\s*\}\}/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+—/g, " —")
    .trim();
}

export function buildExportContext(opts: {
  brief: Brief;
  project?: Project;
  session?: AgentSession;
  template?: ExportTemplate;
  mock?: boolean;
}): ExportDocumentContext {
  const { brief, project, session, template } = opts;
  const now = new Date();
  const pipelineMode = session?.pipelineMode ?? brief.pipelineMode ?? "doctrine";
  const subject = resolveSubject(template, brief);

  const findingsTable = buildFindingsTable(brief);
  // Prefer interactionCards for PSN interactions — keep only the simpler findings table here.
  const tables: ExportTable[] = findingsTable ? [findingsTable] : [];

  const recs = buildRecommendations(brief);
  const gaps = buildGaps(brief);
  const monitoring = buildMonitoring(brief);
  const risk = buildRiskFactors(brief);
  const charts = buildCharts(brief);
  const psnRows = buildPsnRows(brief);
  const interactionCards = buildInteractionCards(brief);
  const scoreParts = buildScoreParts(brief);
  const tradeoffs = indexed(brief.tradeoffs || []);
  const confidenceRows = buildConfidenceRows(brief);
  const confidence = Math.max(0, Math.min(100, brief.confidence || 0));
  const needleDeg = Math.round(-90 + (confidence / 100) * 180);
  const psnCoverage =
    charts.find((c) => c.id === "psn-counts")?.segments?.filter((s) => !s.isZero && s.value > 0) ||
    [];
  const showRiskBars = risk.items.length > 0;
  const showPsnCoverage = psnCoverage.length > 0;
  const showGauge = confidence > 0;
  const showRiskSection =
    showRiskBars || showPsnCoverage || showGauge || scoreParts.length > 0 || confidenceRows.length > 0;

  const decisionQuestion =
    session?.question?.trim() ||
    project?.question?.trim() ||
    brief.title;

  const projectName = project?.name?.trim() || brief.title;

  const cited = buildCitedSources(brief);
  const coverage = buildCoverageNote(brief);

  return {
    meta: {
      title: brief.title,
      subject,
      generatedAt: now.toISOString(),
      generatedAtFormatted: now.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      pipelineMode,
      pipelineLabel: pipelineLabel(pipelineMode),
      logoUrl: "/icon.svg",
      watermarkText: "Octivate — Confidential · For authorised decision use only",
      brandName: "Octivate",
    },
    email: { address: "" },
    brief: {
      ...brief,
      riskLabel: labelRisk(brief.riskLevel),
      confidenceLabel: `${confidence}%`,
      riskBadgeClass: riskBadgeClass(brief.riskLevel),
      statusLabel: humanStatusLabel(brief.status),
      depthLabel: humanDepthLabel(brief.analysisDepth),
      reviewLabel: brief.reviewStatus
        ? humanizeIndicator(brief.reviewStatus)
        : "Active monitoring",
    },
    project,
    session,
    decisionQuestion,
    projectName,
    confidenceDeg: Math.round(confidence * 1.8),
    needleDeg,
    gaugeSvg: showGauge ? renderGaugeSvg(confidence, needleDeg) : "",
    recommendations: recs.items,
    gaps: gaps.items,
    tradeoffs,
    monitoring: monitoring.items,
    power: indexed(brief.power.filter(Boolean)),
    systems: indexed(brief.systems.filter(Boolean)),
    narratives: indexed(brief.narratives.filter(Boolean)),
    powerCount: brief.power.length,
    systemsCount: brief.systems.length,
    narrativesCount: brief.narratives.length,
    psnRows,
    interactionCards,
    riskFactors: risk.items,
    scoreParts,
    psnCoverage,
    charts,
    tables,
    confidenceRows,
    hasRecommendations: recs.items.length > 0,
    hasGaps: gaps.items.length > 0,
    hasCharts: showRiskSection,
    showRiskSection,
    showRiskBars,
    showPsnCoverage,
    showGauge,
    hasPsn:
      brief.power.length > 0 || brief.systems.length > 0 || brief.narratives.length > 0,
    hasMonitoring: monitoring.items.length > 0,
    hasTradeoffs: tradeoffs.length > 0,
    hasConfidenceRows: confidenceRows.length > 0,
    hasInteractionCards: interactionCards.length > 0,
    hasScoreBreakdown: scoreParts.length > 0,
    hasCitedSources: cited.length > 0,
    hasEvidenceCoverage: coverage.hasEvidenceCoverage,
    evidenceCoverage: coverage.evidenceCoverage,
    coverageNote: coverage.coverageNote,
    citedSources: cited,
    recommendationsTruncated: recs.truncated,
    gapsTruncated: gaps.truncated,
    riskFactorsTruncated: risk.truncated,
    monitoringTruncated: monitoring.truncated,
  };
}

export async function loadExportSources(briefId: string) {
  const { readCollection } = await import("@/lib/store/json-store");
  const { SEED_BRIEFS, SEED_PROJECTS } = await import("@/lib/mock/seed");
  const { listSessions } = await import("@/lib/agents/session-store");

  const [briefs, projects, sessions] = await Promise.all([
    readCollection<Brief>("briefs", SEED_BRIEFS),
    readCollection<Project>("projects", SEED_PROJECTS),
    listSessions(),
  ]);

  const brief = briefs.find((b) => b.id === briefId);
  if (!brief) return null;

  const { normalizeBrief } = await import("@/lib/briefs/normalize");
  const normalized = normalizeBrief(brief);

  const project = projects.find((p) => p.id === normalized.projectId);
  const session = normalized.sessionId
    ? sessions.find((s) => s.id === normalized.sessionId)
    : sessions.find((s) => s.briefId === normalized.id);

  return { brief: normalized, project, session };
}

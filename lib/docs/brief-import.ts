/**
 * Detect re-uploaded Octivate Decision Intelligence briefs and extract
 * structured fields so operators can skip a full doctrine pipeline run.
 */

import { createHash } from "crypto";
import { sanitizePlainText } from "@/lib/docs/sanitize-text";

export type ImportedBriefPayload = {
  kind: "octivate_brief";
  title: string;
  country?: string;
  sector?: string;
  executiveSummary: string;
  analyticalJudgement?: string;
  confidence?: number;
  riskLevel?: "low" | "medium" | "high" | "critical";
  recommendations: string[];
  gaps: string[];
  power: string[];
  systems: string[];
  narratives: string[];
  tradeoffs: string[];
  monitoring: string[];
  status?: "draft" | "final";
  contentHash: string;
  detectedAt: string;
};

const MARKERS = [
  /decision intelligence brief/i,
  /octivate/i,
  /power\s*[·•|]\s*systems\s*[·•|]\s*narratives/i,
  /tpl_octivate_brief|tokenized-brief/i,
  /for authorised decision use only|authorized decision use only/i,
];

export function contentSha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function looksLikeOctivateBrief(text: string): boolean {
  const sample = String(text || "").slice(0, 40_000);
  if (!sample.trim()) return false;
  let hits = 0;
  for (const m of MARKERS) {
    if (m.test(sample)) hits += 1;
  }
  return hits >= 2;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function sectionAfter(text: string, heading: RegExp, stop: RegExp): string {
  const m = text.match(heading);
  if (!m || m.index == null) return "";
  const from = m.index + m[0].length;
  const rest = text.slice(from);
  const end = rest.search(stop);
  return (end >= 0 ? rest.slice(0, end) : rest).trim();
}

function bullets(block: string, max = 12): string[] {
  const lines = block
    .split(/\n+/)
    .map((l) => l.replace(/^[\s•\-–—*]+/, "").trim())
    .filter((l) => l.length > 8 && l.length < 600);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    const key = l.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sanitizePlainText(l, 600));
    if (out.length >= max) break;
  }
  return out;
}

function parseConfidence(text: string): number | undefined {
  const m = text.match(/(\d{1,3})\s*%\s*(?:confidence|)/i) || text.match(/confidence[^0-9]{0,24}(\d{1,3})/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(100, n));
}

function parseRisk(text: string): ImportedBriefPayload["riskLevel"] | undefined {
  const m = text.match(/\brisk(?:\s*level)?\s*[:·]?\s*(critical|high|medium|low)\b/i);
  if (!m) return undefined;
  return m[1].toLowerCase() as ImportedBriefPayload["riskLevel"];
}

/** Extract structured brief fields from Octivate HTML/export text. */
export function extractOctivateBrief(
  raw: string,
  opts?: { contentHash?: string }
): ImportedBriefPayload | null {
  if (!looksLikeOctivateBrief(raw)) return null;

  const text = /<\w[\s\S]*>/.test(raw) ? stripTags(raw) : String(raw);
  const hash = opts?.contentHash || contentSha256(text);

  const titleMatch =
    text.match(/Decision Intelligence Brief[^\n]{0,40}\n([^\n]{8,160})/i) ||
    text.match(/^([^\n]{8,160})\n.*Strategic risk read/im);
  const title = sanitizePlainText(
    titleMatch?.[1] ||
      text.match(/Theatre\s+([^\n]{4,120})/i)?.[1] ||
      "Imported Octivate brief",
    200
  );

  const country =
    sanitizePlainText(text.match(/Region\s+([A-Za-z][A-Za-z\s.-]{1,60})/i)?.[1] || "", 80) ||
    undefined;
  const sector =
    sanitizePlainText(text.match(/Sector\s+([A-Za-z][A-Za-z\s/-]{1,60})/i)?.[1] || "", 80) ||
    undefined;

  const situation = sectionAfter(
    text,
    /Situation\s*&\s*Decision Context/i,
    /PSN Analysis|Power\s*[·•|]\s*Systems|Risk Quantification|Evidence\s*&\s*Confidence/i
  );
  const bottom =
    situation.match(/Bottom line:\s*([\s\S]+)/i)?.[1]?.trim() ||
    text.match(/Bottom line:\s*([^\n]{20,400})/i)?.[1];

  const exec = sanitizePlainText(
    situation.replace(/Bottom line:[\s\S]*/i, "").trim() || situation.slice(0, 800),
    2_400
  );

  const powerBlock = sectionAfter(text, /\bPower\b(?:\s+\d+)?/i, /\bSystems\b|\bNarratives\b|Risk Quantification/i);
  const systemsBlock = sectionAfter(text, /\bSystems\b(?:\s+\d+)?/i, /\bNarratives\b|Risk Quantification|Evidence/i);
  const narrativesBlock = sectionAfter(
    text,
    /\bNarratives?\b(?:\s+\d+)?/i,
    /Risk Quantification|Evidence\s*&\s*Confidence|Strategic Options/i
  );

  const recs = bullets(
    sectionAfter(
      text,
      /Strategic Options\s*&\s*Actions|Recommendations/i,
      /What We Cannot Yet Verify|Evidence Gaps|Indicators Under Watch|Monitoring/i
    ),
    8
  );
  const gaps = bullets(
    sectionAfter(
      text,
      /What We Cannot Yet Verify|Evidence Gaps/i,
      /Indicators Under Watch|Monitoring|Cited sources|Confidential/i
    ),
    8
  );
  const monitoring = bullets(
    sectionAfter(text, /Indicators Under Watch|Monitoring/i, /Cited sources|Confidential|Footer/i),
    10
  );
  const tradeoffs = bullets(
    sectionAfter(text, /\bTradeoffs?\b/i, /Strategic Options|Recommendations|Evidence Gaps/i),
    6
  );

  const statusMatch = text.match(/\bStatus\s+(draft|final)\b/i);

  return {
    kind: "octivate_brief",
    title,
    country,
    sector,
    executiveSummary: exec || sanitizePlainText(text.slice(0, 600), 600),
    analyticalJudgement: bottom ? sanitizePlainText(bottom, 1_200) : undefined,
    confidence: parseConfidence(text),
    riskLevel: parseRisk(text),
    recommendations: recs,
    gaps,
    power: bullets(powerBlock, 8),
    systems: bullets(systemsBlock, 8),
    narratives: bullets(narrativesBlock, 8),
    tradeoffs,
    monitoring,
    status: statusMatch ? (statusMatch[1].toLowerCase() as "draft" | "final") : "draft",
    contentHash: hash,
    detectedAt: new Date().toISOString(),
  };
}

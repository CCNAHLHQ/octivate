import type {
  EvidenceClass,
  Source,
  SourceBriefUse,
  SourceRecord,
  SourceReliability,
  SourceRetrievalPriority,
  SourceWatchPriority,
} from "@/lib/types";

export type RegistryCsvRow = Record<string, string>;

function splitList(value: string | undefined, sep: RegExp | string = /,/): string[] {
  if (!value?.trim()) return [];
  return value
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseCountries(raw: string): string[] {
  return splitList(raw, /;/);
}

function intScore(raw: string | undefined, fallback = 0): number {
  const n = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function asBool(raw: string | undefined): boolean {
  return String(raw ?? "").trim().toLowerCase() === "true";
}

function slugId(name: string, url: string): string {
  const base = (url || name || "source")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return `src_${base || "unknown"}`;
}

/** Prefer explicit CSV source_id when present; otherwise slug from name/url. */
function resolveSourceId(row: RegistryCsvRow, name: string, url: string): string {
  const raw = (row.source_id || "").trim().toLowerCase();
  if (raw) {
    const cleaned = raw
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 72);
    if (cleaned) return cleaned.startsWith("src_") ? cleaned : `src_${cleaned}`;
  }
  return slugId(name, url);
}

function firstText(...values: Array<string | undefined>): string | undefined {
  for (const v of values) {
    const t = (v || "").trim();
    if (t) return t;
  }
  return undefined;
}

export function normalizeSourceUrl(url: string | undefined): string {
  if (!url?.trim()) return "";
  try {
    const u = new URL(url.trim());
    u.hash = "";
    const path = u.pathname.replace(/\/+$/, "") || "";
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, "");
  }
}

export function deriveTier(
  watch: SourceWatchPriority | undefined,
  total: number,
  retrieval: SourceRetrievalPriority | undefined
): 1 | 2 | 3 | 4 {
  if (watch === "Core" && total >= 18) return 1;
  if (watch === "Core") return 2;
  if (retrieval === "High") return 3;
  return 4;
}

export function mapEvidenceClass(source: Source): EvidenceClass {
  const type = (source.type || "").toLowerCase();
  const roles = (source.evidenceRoles || []).map((r) => r.toLowerCase());

  if (roles.some((r) => r.includes("weak signal"))) {
    return "weak_unverified_signal";
  }
  if (
    type.includes("political party") ||
    type.includes("campaign") ||
    type.includes("state media")
  ) {
    return "direct_actor";
  }
  if (
    type.includes("gazette") ||
    type.includes("legal database") ||
    type.includes("central bank") ||
    type.includes("statistical") ||
    type.includes("procurement") ||
    type.includes("audit") ||
    type.includes("regulator") ||
    type.includes("ministry") ||
    type.includes("judiciary") ||
    type.includes("revenue") ||
    type.includes("customs")
  ) {
    return "primary_authoritative";
  }
  if (type.includes("multilateral") || type.includes("global standard")) {
    return "primary_authoritative";
  }
  if (roles.some((r) => r.includes("narrative signal"))) {
    return "public_discourse_signal";
  }
  if (type.includes("business media") || type.includes("media") || type.includes("newswire")) {
    return "independent_reporting";
  }
  if (type.includes("civil society") || type.includes("watchdog")) {
    return "expert_interpretation";
  }
  if (type.includes("corporate") || type.includes("operator")) {
    return "behavioural_operational_signal";
  }
  if (roles.some((r) => r.includes("primary evidence"))) {
    return "primary_authoritative";
  }
  return "independent_reporting";
}

export function mapReliability(source: Source): SourceReliability {
  const score = source.reliabilityScore ?? 0;
  if (source.humanReviewRequired && score <= 3) return "unclear";
  if (score >= 5) return "high";
  if (score >= 3) return "moderate";
  if (score > 0) return "low";
  return source.health === "healthy" ? "high" : "moderate";
}

export function registryRowToSource(row: RegistryCsvRow, importedAt: string): Source {
  const countries = parseCountries(row.country || "");
  const watch = (row.watch_priority || "Secondary") as SourceWatchPriority;
  const retrieval = (row.retrieval_priority || "Medium") as SourceRetrievalPriority;
  const total = intScore(row.total_source_score);
  const title = row.source_name || "Untitled source";
  const url = row.source_url || undefined;
  const userRelevance = splitList(row.user_relevance).length
    ? splitList(row.user_relevance)
    : splitList(row.client_types_that_would_care);

  return {
    id: resolveSourceId(row, title, url || ""),
    title,
    tier: deriveTier(watch, total, retrieval),
    country: countries[0] || row.country || "Regional",
    countries: countries.length ? countries : [row.country || "Regional"].filter(Boolean),
    type: row.source_type || row.source_type_preset || "Unknown",
    typePreset: row.source_type_preset || undefined,
    url,
    primaryRetrievalUrl: row.primary_retrieval_url || undefined,
    dataPublicationsUrl: row.data_publications_url || undefined,
    subregion: row.subregion || undefined,
    institutionOwner: row.institution_owner || undefined,
    psnLayers: splitList(row.psn_layers),
    sectorTags: splitList(row.sector_tags),
    userRelevance,
    bestUsedFor: firstText(row.best_used_for, row.best_intelligence_uses),
    limitationsBiasNote: firstText(row.limitations_bias_note, row.known_limitations),
    evidenceRoles: splitList(row.evidence_roles),
    triangulationRequirement: row.triangulation_requirement || undefined,
    reliabilityScore: intScore(row.reliability_score),
    timelinessScore: intScore(row.timeliness_score),
    signalValueScore: intScore(row.signal_value_score),
    decisionUsefulnessScore: intScore(row.decision_usefulness_score),
    totalSourceScore: total,
    watchPriority: watch,
    retrievalPriority: retrieval,
    briefUse: (row.brief_use || undefined) as SourceBriefUse | undefined,
    humanReviewRequired: asBool(row.human_review_required),
    notes: firstText(row.notes, row.registry_notes, row.passport_notes),
    sourceSummary: firstText(row.source_summary),
    whyThisSourceMatters: firstText(row.why_this_source_matters),
    exampleQuestions: firstText(row.example_questions),
    analystConfidence: firstText(row.analyst_confidence),
    health: "healthy",
    lastChecked: importedAt,
    registryImportedAt: importedAt,
  };
}

export function reviewFlagsForSource(source: Source): string[] {
  const flags: string[] = [];
  if (source.humanReviewRequired) flags.push("human_review");
  if (source.briefUse === "Cite with Context") flags.push("cite_with_context");
  if (source.briefUse === "Background Only") flags.push("background_only");
  return flags;
}

export function sourceToRecord(
  source: Source,
  project: { country: string; sector: string }
): SourceRecord {
  const bias = source.limitationsBiasNote?.trim();
  const best = (source.bestUsedFor || "").slice(0, 280);
  return {
    source_id: source.id,
    title: source.title,
    evidence_class: mapEvidenceClass(source),
    reliability: mapReliability(source),
    decision_relevance:
      best ||
      `${project.sector} decision context for ${project.country}`,
    url: source.primaryRetrievalUrl || source.url,
    country: source.country,
    retrieved_at: source.lastChecked,
    author_or_issuer: source.institutionOwner || null,
    known_biases_or_incentives: bias ? [bias] : undefined,
    review_flags: reviewFlagsForSource(source),
    brief_use: source.briefUse,
    psn_layers: source.psnLayers,
    sector_tags: source.sectorTags,
  };
}

/** Truncate bias note to one prompt line. */
export function biasOneLiner(source: Source, max = 160): string {
  const t = (source.limitationsBiasNote || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function formatSourcePromptLine(source: Source, record: SourceRecord): string {
  const layers = (source.psnLayers || []).join("/");
  const bias = biasOneLiner(source);
  const parts = [
    `${record.source_id}: ${source.title}`,
    `type=${source.type}`,
    source.primaryRetrievalUrl || source.url
      ? `url=${source.primaryRetrievalUrl || source.url}`
      : null,
    layers ? `psn=${layers}` : null,
    source.briefUse ? `brief_use=${source.briefUse}` : null,
    `reliability=${record.reliability}`,
    `evidence_class=${record.evidence_class}`,
    bias ? `bias=${bias}` : null,
  ].filter(Boolean);
  return `- ${parts.join(" | ")}`;
}

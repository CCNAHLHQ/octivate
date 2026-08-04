import type { Source } from "@/lib/types";

/** Routing / policy descriptors for future pipeline proxying (meta.json). */
export type CaptureRegistryBlock = {
  country?: string;
  countries?: string[];
  subregion?: string;
  institutionOwner?: string;
  type?: string;
  typePreset?: string;
  tier?: 1 | 2 | 3 | 4;
  psnLayers?: string[];
  sectorTags?: string[];
  userRelevance?: string[];
  evidenceRoles?: string[];
  briefUse?: string;
  watchPriority?: string;
  retrievalPriority?: string;
  humanReviewRequired?: boolean;
  triangulationRequirement?: string;
  reliabilityScore?: number;
  timelinessScore?: number;
  signalValueScore?: number;
  decisionUsefulnessScore?: number;
  totalSourceScore?: number;
  primaryRetrievalUrl?: string;
  dataPublicationsUrl?: string;
  registryImportedAt?: string;
};

/** Passport narratives from imported CSVs (document.json). */
export type CapturePassportBlock = {
  sourceSummary?: string;
  whyThisSourceMatters?: string;
  exampleQuestions?: string;
  bestUsedFor?: string;
  limitationsBiasNote?: string;
  analystConfidence?: string;
  notes?: string;
};

/**
 * Stable route keys so recurring / new outputs can be proxied into the
 * right downstream processors (brief cite policy, PSN layer, sector, watch).
 */
export type CapturePipelineHints = {
  routes: string[];
  briefUse?: string;
  watchPriority?: string;
  retrievalPriority?: string;
  psnLayers?: string[];
  sectorTags?: string[];
  evidenceRoles?: string[];
  triangulationRequirement?: string;
  humanReviewRequired?: boolean;
  tier?: 1 | 2 | 3 | 4;
};

function slugToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function compactStrings(values?: string[]): string[] | undefined {
  if (!values?.length) return undefined;
  const next = values.map((v) => v.trim()).filter(Boolean);
  return next.length ? next : undefined;
}

export function buildCaptureRegistry(source: Source): CaptureRegistryBlock {
  return {
    country: source.country || undefined,
    countries: compactStrings(source.countries),
    subregion: source.subregion || undefined,
    institutionOwner: source.institutionOwner || undefined,
    type: source.type || undefined,
    typePreset: source.typePreset || undefined,
    tier: source.tier,
    psnLayers: compactStrings(source.psnLayers),
    sectorTags: compactStrings(source.sectorTags),
    userRelevance: compactStrings(source.userRelevance),
    evidenceRoles: compactStrings(source.evidenceRoles),
    briefUse: source.briefUse || undefined,
    watchPriority: source.watchPriority || undefined,
    retrievalPriority: source.retrievalPriority || undefined,
    humanReviewRequired: source.humanReviewRequired,
    triangulationRequirement: source.triangulationRequirement || undefined,
    reliabilityScore: source.reliabilityScore,
    timelinessScore: source.timelinessScore,
    signalValueScore: source.signalValueScore,
    decisionUsefulnessScore: source.decisionUsefulnessScore,
    totalSourceScore: source.totalSourceScore,
    primaryRetrievalUrl: source.primaryRetrievalUrl || undefined,
    dataPublicationsUrl: source.dataPublicationsUrl || undefined,
    registryImportedAt: source.registryImportedAt || undefined,
  };
}

export function buildCapturePassport(source: Source): CapturePassportBlock {
  return {
    sourceSummary: source.sourceSummary || undefined,
    whyThisSourceMatters: source.whyThisSourceMatters || undefined,
    exampleQuestions: source.exampleQuestions || undefined,
    bestUsedFor: source.bestUsedFor || undefined,
    limitationsBiasNote: source.limitationsBiasNote || undefined,
    analystConfidence: source.analystConfidence || undefined,
    notes: source.notes || undefined,
  };
}

export function buildCapturePipelineHints(source: Source): CapturePipelineHints {
  const routes = new Set<string>();

  if (source.briefUse === "Direct Citation") routes.add("brief.cite.direct");
  else if (source.briefUse === "Cite with Context") routes.add("brief.cite.context");
  else if (source.briefUse === "Background Only") routes.add("brief.background");

  if (source.watchPriority === "Core") routes.add("watch.core");
  else if (source.watchPriority === "Secondary") routes.add("watch.secondary");

  if (source.retrievalPriority === "High") routes.add("retrieval.high");
  else if (source.retrievalPriority === "Medium") routes.add("retrieval.medium");
  else if (source.retrievalPriority === "Low") routes.add("retrieval.low");

  if (source.humanReviewRequired) routes.add("review.human");

  for (const layer of source.psnLayers || []) {
    const slug = slugToken(layer);
    if (slug) routes.add(`psn.${slug}`);
  }
  for (const sector of source.sectorTags || []) {
    const slug = slugToken(sector);
    if (slug) routes.add(`sector.${slug}`);
  }
  for (const role of source.evidenceRoles || []) {
    const slug = slugToken(role);
    if (slug) routes.add(`evidence.${slug}`);
  }

  if (source.country) {
    const slug = slugToken(source.country);
    if (slug) routes.add(`geo.${slug}`);
  }

  return {
    routes: Array.from(routes).sort(),
    briefUse: source.briefUse || undefined,
    watchPriority: source.watchPriority || undefined,
    retrievalPriority: source.retrievalPriority || undefined,
    psnLayers: compactStrings(source.psnLayers),
    sectorTags: compactStrings(source.sectorTags),
    evidenceRoles: compactStrings(source.evidenceRoles),
    triangulationRequirement: source.triangulationRequirement || undefined,
    humanReviewRequired: source.humanReviewRequired,
    tier: source.tier,
  };
}

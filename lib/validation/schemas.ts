import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(2).max(120),
  country: z.string().min(2).max(80),
  sector: z.string().min(2).max(80),
});

export const askQuestionSchema = z.object({
  question: z.string().min(10).max(2000),
  analysisDepth: z.enum(["rapid", "standard", "deep_dive"]).optional(),
  /** Replace any in-flight run on this project (used by Rerun workflow). */
  force: z.boolean().optional(),
  /** Prefer paid/premium model when OperatorLimits.allowPremiumModels is true. */
  usePaidModel: z.boolean().optional(),
});

export const scoringPolicySchema = z.object({
  sourceScoreW: z.number().min(0).max(100),
  labelMatchW: z.number().min(0).max(100),
  agentConfW: z.number().min(0).max(100),
  triangulationW: z.number().min(0).max(100),
  freshnessW: z.number().min(0).max(100),
});

export const updateProjectSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  country: z.string().min(2).max(80).optional(),
  sector: z.string().min(2).max(80).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export const addProjectDocumentSchema = z.object({
  name: z.string().min(1).max(240),
  type: z.string().min(1).max(40).optional(),
  size: z.number().int().nonnegative().max(1_000_000_000).optional(),
});

export const createMonitorSchema = z.object({
  name: z.string().min(2).max(120),
  keywords: z.array(z.string()).min(1).max(20),
  countries: z.array(z.string()).min(1).max(20),
  projectId: z.string().min(1).optional(),
});

export const updateMonitorSchema = z.object({
  status: z.enum(["active", "paused"]).optional(),
  name: z.string().min(2).max(120).optional(),
  keywords: z.array(z.string()).min(1).max(20).optional(),
  countries: z.array(z.string()).min(1).max(20).optional(),
  projectId: z.string().min(1).nullable().optional(),
});

export const createBriefSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(2).max(200),
  country: z.string().min(2),
  sector: z.string().min(2),
  executiveSummary: z.string().min(10),
  confidence: z.number().min(0).max(100).optional(),
});

export const updateLimitsSchema = z.object({
  tokensPerDay: z.number().int().min(1000).max(10_000_000).optional(),
  concurrentAgents: z.number().int().min(1).max(20).optional(),
  maxUploadsPerProject: z.number().int().min(1).max(200).optional(),
  maxFileSizeMb: z.number().int().min(1).max(500).optional(),
  maxAvatarSizeKb: z.number().int().min(1024).max(10240).optional(),
  allowAutogenerateAccounts: z.boolean().optional(),
  maxProfileBioChars: z.number().int().min(200).max(10_000).optional(),
  documentRetentionDays: z.number().int().min(1).max(3650).optional(),
  allowPremiumModels: z.boolean().optional(),
  requireHumanReview: z.boolean().optional(),
  mockOpenRouter: z.boolean().optional(),
});

export const briefReviewSchema = z.object({
  action: z.enum(["approve", "reject", "needs_revision"]),
  notes: z.string().max(2000).optional(),
});

/** Public mailing-list subscribe / unsubscribe (honeypot: website). */
export const mailingListSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().max(80).optional().or(z.literal("")),
  action: z.enum(["subscribe", "unsubscribe"]).default("subscribe"),
  consent: z.boolean().optional(),
  /** Honeypot — non-empty values are treated as bots */
  website: z.string().max(200).optional(),
});

export const marqueeKindSchema = z.enum(["power", "systems", "narrative", "proc"]);

export const createMarqueeSchema = z.object({
  badge: z.string().min(2).max(24),
  kind: marqueeKindSchema,
  text: z.string().min(4).max(240),
  enabled: z.boolean().optional(),
});

export const updateMarqueeSchema = z.object({
  badge: z.string().min(2).max(24).optional(),
  kind: marqueeKindSchema.optional(),
  text: z.string().min(4).max(240).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export const exportFormatSchema = z.enum(["html", "pdf", "docx", "pptx"]);

// Templates embed logos/watermarks as base64 data URIs — allow generous bodies.
const HTML_BODY_MAX = 4_000_000;

export const createExportTemplateSchema = z.object({
  name: z.string().min(2).max(160),
  description: z.string().max(500).optional(),
  subjectPreset: z.string().max(120).optional(),
  campaignSubject: z.string().max(240).optional(),
  htmlBody: z.string().min(10).max(HTML_BODY_MAX).optional(),
  supportsFormats: z.array(exportFormatSchema).min(1).max(4).optional(),
  enabled: z.boolean().optional(),
});

export const updateExportTemplateSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  description: z.string().max(500).optional(),
  subjectPreset: z.string().max(120).optional(),
  campaignSubject: z.string().max(240).optional(),
  htmlBody: z.string().min(10).max(HTML_BODY_MAX).optional(),
  supportsFormats: z.array(exportFormatSchema).min(1).max(4).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const reorderExportTemplatesSchema = z.object({
  order: z.array(z.string().min(1)).min(1).max(200),
});

export const exportBriefSchema = z.object({
  templateId: z.string().min(1),
  format: exportFormatSchema,
  mock: z.boolean().optional(),
});

const optionalUrl = z.union([z.string().max(2000), z.null()]).optional();
const tagList = z.array(z.string().min(1).max(80)).max(40).optional();

/** Shorthand curation patch for live source registry rows. */
export const updateSourceSchema = z.object({
  title: z.string().min(2).max(240).optional(),
  country: z.string().min(1).max(120).optional(),
  countries: z.array(z.string().min(1).max(120)).max(20).optional(),
  type: z.string().min(1).max(120).optional(),
  url: optionalUrl,
  primaryRetrievalUrl: optionalUrl,
  dataPublicationsUrl: optionalUrl,
  sectorTags: tagList,
  psnLayers: tagList,
  userRelevance: tagList,
  evidenceRoles: tagList,
  watchPriority: z.enum(["Core", "Secondary"]).optional(),
  retrievalPriority: z.enum(["High", "Medium", "Low"]).optional(),
  briefUse: z
    .enum(["Direct Citation", "Cite with Context", "Background Only"])
    .nullable()
    .optional(),
  humanReviewRequired: z.boolean().optional(),
  notes: z.string().max(4000).nullable().optional(),
  institutionOwner: z.string().max(240).nullable().optional(),
  subregion: z.string().max(120).nullable().optional(),
});

const mailTemplateFields = {
  name: z.string().min(2).max(160).optional(),
  description: z.string().max(500).optional(),
  kind: z.string().min(1).max(40).optional(),
  subject: z.string().min(1).max(200).optional(),
  preheader: z.string().max(200).optional(),
  eyebrow: z.string().max(80).optional(),
  text: z.string().min(1).max(20000).optional(),
  bullets: z.array(z.string().min(1).max(240)).max(8).optional(),
  ctaLabel: z.string().max(80).optional(),
  ctaUrl: z.string().max(2000).optional(),
  signOff: z.string().max(80).optional(),
  signOffRole: z.string().max(120).optional(),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
};

export const updateMailTemplateSchema = z.object(mailTemplateFields);

/** Draft overrides for operator mail template preview. */
export const previewMailTemplateSchema = z.object({
  subject: z.string().max(200).optional(),
  text: z.string().max(20000).optional(),
  from: z.string().max(200).optional(),
  preheader: z.string().max(200).optional(),
  eyebrow: z.string().max(80).optional(),
  bullets: z.array(z.string().min(1).max(240)).max(8).optional(),
  ctaLabel: z.string().max(80).optional(),
  ctaUrl: z.string().max(2000).optional(),
  signOff: z.string().max(80).optional(),
  signOffRole: z.string().max(120).optional(),
});

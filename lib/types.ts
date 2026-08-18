export type AgentName =
  | "intake"
  | "planning"
  | "retrieval"
  | "validation"
  | "analysis"
  | "decision"
  | "monitoring"
  | "learning";

export type DoctrineAgentName =
  | "decision_intake"
  | "evidence_manager"
  | "power_analyst"
  | "systems_analyst"
  | "narrative_analyst"
  | "psn_synthesiser"
  | "scenario_recommendation"
  | "human_review_assistant";

export type AgentStatus = "pending" | "running" | "completed" | "failed";
export type PipelineMode = "mock" | "doctrine";
export type AnalysisDepth = "rapid" | "standard" | "deep_dive";
export type OutputStatus =
  | "complete"
  | "partial"
  | "insufficient_evidence"
  | "not_applicable"
  | "invalid_input"
  | "further_research_required";
export type ConfidenceLabel =
  | "high"
  | "moderate"
  | "low"
  | "plausible_unverified"
  | "insufficient_evidence";
export type JudgementType = "fact" | "inference" | "assumption" | "forecast" | "unknown";
export type BriefReviewStatus = "draft" | "pending_review" | "approved" | "rejected";

export interface MaterialFinding {
  finding_id: string;
  finding: string;
  decision_effect: string;
  evidence_ids: string[];
  judgement_type: JudgementType;
  confidence: ConfidenceLabel;
  review_flags: string[];
  competing_explanations?: string[];
  disconfirming_evidence?: string[];
  monitoring_indicators?: string[];
  materiality_justification?: string;
}

export interface CommonAgentOutput {
  agent: DoctrineAgentName | string;
  decision_id: string;
  analysis_depth: AnalysisDepth;
  output_status: OutputStatus;
  material_findings: MaterialFinding[];
  evidence_gaps: string[];
  overall_confidence: ConfidenceLabel;
  review_flags: string[];
  additional_research_requests?: string[];
  limit_exceeded_reason?: string | null;
}

export interface DecisionIntake {
  decision_question: string;
  decision_owner: string;
  timeframe: string;
  geographic_scope: string;
  options: string[];
  consequence_of_error: string;
  principal_uncertainty: string;
  constraints?: string[];
  monitoring_requirement?: string;
}

export type EvidenceClass =
  | "primary_authoritative"
  | "direct_actor"
  | "independent_reporting"
  | "expert_interpretation"
  | "behavioural_operational_signal"
  | "public_discourse_signal"
  | "weak_unverified_signal";

export type SourceReliability = "high" | "moderate" | "low" | "unclear";

export interface SourceRecord {
  source_id: string;
  title: string;
  evidence_class: EvidenceClass | string;
  reliability: SourceReliability | string;
  decision_relevance: string;
  url?: string;
  country?: string;
  retrieved_at?: string;
  author_or_issuer?: string | null;
  publication_date?: string | null;
  known_biases_or_incentives?: string[];
  corroborating_source_ids?: string[];
  review_flags?: string[];
  brief_use?: SourceBriefUse;
  psn_layers?: string[];
  sector_tags?: string[];
}

export interface EvidenceClaim {
  claim_id: string;
  statement: string;
  source_ids: string[];
  judgement_type: JudgementType;
  decision_relevance: string;
  confidence?: ConfidenceLabel;
  /** Local evidence document ids that ground this claim. */
  evidence_ids?: string[];
  /** Atomic claim structure for temporal / current-state resolution. */
  subject?: string;
  predicate?: string;
  objectValue?: string;
  eventDate?: string;
  observedAt?: string;
  issuedAt?: string;
  deadlineAt?: string;
  component?: string;
  lifecycleState?: string;
}

/** Deterministic as-of opportunity / procurement state fact. */
export interface ProjectStateFact {
  fact_id: string;
  subject: string;
  component: string;
  state: string;
  issuedAt?: string;
  deadlineAt?: string;
  observedAt?: string;
  validFrom?: string;
  validTo?: string;
  sourceIds: string[];
  evidenceIds: string[];
  claimIds: string[];
  supersedesFactIds: string[];
  confidence: number;
  statusVerified: boolean;
  asOf: string;
  statement?: string;
}

export type EvidenceGapCategory =
  | "evidence_gap"
  | "pipeline_qa"
  | "analytical_uncertainty"
  | "non_gap";

export interface EvidenceGap {
  gap_id: string;
  category: EvidenceGapCategory;
  subject?: string;
  missing_information: string;
  decision_effect?: string;
  materiality: "decision_critical" | "material" | "minor";
  source_context?: string;
  status: "unresolved" | "resolved" | "internal";
  internal_only: boolean;
  confidence: number;
}

export interface PsnInteraction {
  interaction_id: string;
  power_component: string;
  systems_component: string;
  narrative_component: string;
  causal_interaction: string;
  decision_effect: string;
  confidence: ConfidenceLabel;
  evidence_ids: string[];
}

export interface RecommendationOutput {
  analytical_judgement: string;
  options: {
    label: string;
    description: string;
    risk: string;
    /** Client-facing title; finding_id stays internal via label only when needed for provenance. */
    option_title?: string;
    finding_id?: string;
  }[];
  preferred_option: string;
  tradeoffs: string[];
  reassessment_triggers: string[];
}

export interface HumanReviewRecord {
  id: string;
  briefId: string;
  sessionId: string;
  review_status: "pending" | "approved" | "rejected" | "needs_revision";
  reviewer_notes?: string;
  reviewer_actions: string[];
  final_approval: boolean;
  reviewedAt?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  at: string;
  action: string;
  sessionId?: string;
  briefId?: string;
  detail?: string;
  outputHash?: string;
}

export interface Project {
  id: string;
  name: string;
  country: string;
  sector: string;
  question?: string;
  documents: {
    id: string;
    name: string;
    type: string;
    uploadedAt: string;
    /** Last material change (summary/rework); retention clock prefers this over uploadedAt. */
    changedAt?: string;
    size?: number;
    expiresAt?: string;
    mime?: string;
    summary?: string;
    summaryStatus?: "idle" | "running" | "ready" | "failed";
    summaryAt?: string;
    /** Operator-facing reason when summaryStatus is failed. */
    summaryError?: string;
    /** Optional operator focus used on the last summarize/rework run. */
    summaryFocus?: string;
    /** Structured fields from the document_summarizer pipeline. */
    summaryPayload?: {
      status?: string;
      key_points?: string[];
      decision_relevance?: string;
      gaps?: string[];
      risk_flags?: string[];
      review_flags?: string[];
      recommendation_hints?: string[];
      psn_hints?: {
        power?: string[];
        systems?: string[];
        narratives?: string[];
      };
      method?: "stuff" | "map_reduce" | "import_shortcut";
      chunk_count?: number;
    };
    /** SHA-256 of uploaded bytes — dedupe / re-upload detection. */
    contentHash?: string;
    /** Recognized upload kind (e.g. prior Octivate brief export). */
    kind?: "file" | "octivate_brief";
    /** Structured extract when an Octivate brief HTML/export is re-uploaded. */
    importPayload?: {
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
  }[];
  /** Draft multi-tenant ownership — filtered when auth session present. */
  ownerId?: string;
  /** Last analysis depth selected for this theatre (persisted on ask/rerun). */
  analysisDepth?: AnalysisDepth;
  createdAt: string;
  updatedAt: string;
  status: "active" | "archived";
}

export interface Brief {
  id: string;
  projectId: string;
  sessionId?: string;
  title: string;
  country: string;
  sector: string;
  executiveSummary: string;
  confidence: number;
  recommendations: string[];
  gaps: string[];
  power: string[];
  systems: string[];
  narratives: string[];
  /** Independent operating/commercial/political risk — not derived from confidence. */
  riskLevel: "low" | "medium" | "high" | "critical" | "unassessed";
  createdAt: string;
  status: "draft" | "final";
  /** Doctrine pipeline fields */
  pipelineMode?: PipelineMode;
  analysisDepth?: AnalysisDepth;
  reviewStatus?: BriefReviewStatus;
  structuredFindings?: {
    power: MaterialFinding[];
    systems: MaterialFinding[];
    narratives: MaterialFinding[];
  };
  psnInteractions?: PsnInteraction[];
  evidenceGaps?: string[];
  reviewFlags?: string[];
  analyticalJudgement?: string;
  tradeoffs?: string[];
  /** Resolved citations for brief UI chips / export footnotes */
  citedSources?: BriefCitedSource[];
  /** Deterministic current-state facts used for judgement / release gate. */
  currentStateFacts?: ProjectStateFact[];
  /** PSN lens coverage after gate (full | partial | insufficient). */
  psnCoverage?: "full" | "partial" | "insufficient";
  /** User-facing depth caution shown before human review */
  depthDisclaimer?: string;
  /** Weighted confidence breakdown from ScoringPolicy. */
  scoreBreakdown?: {
    total: number;
    parts: {
      sourceScore: number;
      labelMatch: number;
      agentConf: number;
      triangulation: number;
      freshness: number;
      currentState?: number;
      provenance?: number;
    };
    policy: {
      sourceScoreW: number;
      labelMatchW: number;
      agentConfW: number;
      triangulationW: number;
      freshnessW: number;
    };
    /** Hard-capped when decision-critical state is UNKNOWN. */
    hardCapped?: boolean;
  };
  /** Run used local-only sources (capture / parl / uploads). */
  localOnlySources?: boolean;
  /** Document packing coverage for operator honesty in UI/export. */
  evidenceCoverage?: {
    totalDocs: number;
    includedDocs: number;
    skippedDocIds: string[];
    includedDocIds: string[];
    truncated: boolean;
    charBudget: number;
    charCount: number;
    note?: string;
  };
}

export interface BriefCitedPassage {
  text: string;
  start?: number;
  end?: number;
  score?: number;
  query?: string;
}

export interface BriefCitedSource {
  id: string;
  label: string;
  title: string;
  url?: string;
  publishedAt?: string;
  snippet?: string;
  passageCount?: number;
  pageCoveragePct?: number;
  /** Local capture artifact folder when available. */
  captureFolder?: string;
  /** Pipeline route keys from capture descriptors. */
  routes?: string[];
  /** Keyword indicator labels applied locally. */
  labels?: string[];
  /** Exact local passages supporting this citation. */
  passages?: BriefCitedPassage[];
  /** True when no accepted local passage could be grounded. */
  ungrounded?: boolean;
  /** Matched relevance keywords for operator / chip display. */
  matchedKeywords?: string[];
  /** Integer 0–100 relevance (do not multiply again in UI). */
  relevanceScore?: number;
  /** Claim IDs this source actually supports in the brief. */
  supportedClaimIds?: string[];
  /** Finding IDs this source supports. */
  supportedFindingIds?: string[];
}

export interface Monitor {
  id: string;
  name: string;
  keywords: string[];
  countries: string[];
  status: "active" | "paused";
  lastAlertAt?: string;
  alertCount: number;
  /** Optional link to a project workspace */
  projectId?: string;
}

export interface MonitorSignal {
  id: string;
  source: "trend" | "marquee";
  title: string;
  summary: string;
  severity?: Trend["severity"];
  badge?: string;
  publishedAt: string;
  matchedKeywords: string[];
}

export type SourceWatchPriority = "Core" | "Secondary";
export type SourceRetrievalPriority = "High" | "Medium" | "Low";
export type SourceBriefUse = "Direct Citation" | "Cite with Context" | "Background Only";

export interface Source {
  id: string;
  title: string;
  tier: 1 | 2 | 3 | 4;
  country: string;
  /** All country tokens when CSV lists multiple (semicolon-separated). */
  countries?: string[];
  type: string;
  typePreset?: string;
  url?: string;
  primaryRetrievalUrl?: string;
  dataPublicationsUrl?: string;
  subregion?: string;
  institutionOwner?: string;
  psnLayers?: string[];
  sectorTags?: string[];
  userRelevance?: string[];
  bestUsedFor?: string;
  limitationsBiasNote?: string;
  evidenceRoles?: string[];
  triangulationRequirement?: string;
  reliabilityScore?: number;
  timelinessScore?: number;
  signalValueScore?: number;
  decisionUsefulnessScore?: number;
  totalSourceScore?: number;
  watchPriority?: SourceWatchPriority;
  retrievalPriority?: SourceRetrievalPriority;
  briefUse?: SourceBriefUse;
  humanReviewRequired?: boolean;
  notes?: string;
  /** Passport narrative from merged registry CSVs. */
  sourceSummary?: string;
  whyThisSourceMatters?: string;
  exampleQuestions?: string;
  analystConfidence?: string;
  health: "healthy" | "degraded" | "down";
  lastChecked: string;
  /** When the availability probe last completed (ISO). */
  healthCheckedAt?: string;
  healthStatusCode?: number;
  healthLatencyMs?: number;
  /** Typed probe failure code when not cleanly healthy. */
  healthError?: SourceHealthErrorCode | string;
  /** URL actually probed. */
  healthUrl?: string;
  /** Pointer to newest successful capture folder name under source-artifacts. */
  lastCaptureAt?: string;
  lastCaptureFolder?: string;
  lastCaptureError?: string;
  /** Pipeline route keys from last successful capture (registry-derived). */
  lastCaptureRoutes?: string[];
  registryImportedAt?: string;
}

export type SourceHealthErrorCode =
  | "ssrf_blocked"
  | "invalid_url"
  | "timeout"
  | "dns"
  | "tls"
  | "http_4xx"
  | "http_5xx"
  | "rate_limited"
  | "too_many_redirects"
  | "no_url"
  | "network"
  /** Site origin responds; curated retrieval path does not (stale deep link). */
  | "path_not_found";

export type SourceProbeConfig = {
  enabled: boolean;
  intervalHours: number;
  staleAfterHours: number;
  concurrency: number;
  timeoutMs: number;
  perDomainGapMs: number;
  batchSize: number;
  /** Phase 2 capture — off until Playwright/Crawlee runner is installed. */
  captureEnabled: boolean;
  captureMaxVersions: number;
  captureMaxHtmlBytes: number;
};

export type SourceCaptureQueueItem = {
  id: string;
  sourceId: string;
  sourceTitle: string;
  url: string;
  queuedAt: string;
  status: "pending" | "running" | "done" | "failed";
  error?: string;
  folder?: string;
  finishedAt?: string;
};

/** Visual recognition tier — ceremonial, not a valuation. */
export type StakeholderRecognition = "founding" | "patron" | "champion" | "ally";

/** Emblem accent drawn from Octivate mark language. */
export type StakeholderEmblem = "coral" | "tide" | "violet" | "foam";

/**
 * Sponsors who stand with Octivate’s Caribbean decision-intelligence cause.
 * No influence scores, graphs, or valuations — sponsorship narrative only.
 */
export interface Stakeholder {
  id: string;
  name: string;
  org: string;
  country: string;
  recognition: StakeholderRecognition;
  emblem: StakeholderEmblem;
  /** The cause thread they underwrite. */
  cause: string;
  /** How they sponsor / stand with the work. */
  sponsorship: string;
}

export interface CountryPack {
  id: string;
  country: string;
  sectors: string[];
  sources: number;
  entities: number;
  updatedAt: string;
}

export interface Trend {
  id: string;
  title: string;
  country: string;
  sector: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  summary: string;
  publishedAt: string;
}

export interface AgentStage {
  name: AgentName | DoctrineAgentName | string;
  label: string;
  status: AgentStatus;
  progress: number;
  message?: string;
  startedAt?: string;
  completedAt?: string;
  outputStatus?: OutputStatus;
}

export interface AgentSession {
  id: string;
  projectId: string;
  question: string;
  status: AgentStatus;
  stages: AgentStage[];
  briefId?: string;
  tokensUsed: number;
  estimatedCostUsd: number;
  startedAt: string;
  /** Last persist / progress touch — used to detect abandoned runs. */
  updatedAt?: string;
  completedAt?: string;
  pipelineMode?: PipelineMode;
  analysisDepth?: AnalysisDepth;
  decisionId?: string;
  workflowState?: string;
  agentOutputs?: CommonAgentOutput[];
  modelUsed?: string;
  /** Last pipeline failure message (opaque-safe for UI). */
  error?: string;
  /** Structured failure diagnostics for operators / logs. */
  errorDetail?: {
    code?: string;
    model?: string;
    stage?: string;
    finishReason?: string;
    at?: string;
    /** Extended operator diagnostics (optional). */
    kind?: string;
    rawContentLen?: number;
  };
  /** Set after tokens/cost are flushed to the cost ledger (prevents double-count). */
  usageRecorded?: boolean;
  /** Whether this run resolved the premium model route. */
  usedPremium?: boolean;
  /** Project requested paid model (honored only when allowPremiumModels). */
  preferPremium?: boolean;
  /** Restrict brief cites to sources with local evidence text. */
  localOnlySources?: boolean;
  /** How session spend was priced across completions. */
  costSource?: "openrouter" | "estimate" | "mixed";
}

export interface UsageSnapshot {
  tokensUsed: number;
  tokensLimit: number;
  estimatedCostUsd: number;
  briefsGenerated: number;
  sessionsRun: number;
  period: string;
}

export interface OperatorLimits {
  tokensPerDay: number;
  concurrentAgents: number;
  maxUploadsPerProject: number;
  maxFileSizeMb: number;
  /** Max profile avatar upload size in kilobytes (default 2048 = 2 MB). */
  maxAvatarSizeKb: number;
  /** Max characters allowed in a user profile description (BBCode source). */
  maxProfileBioChars: number;
  /**
   * Data-policy retention for project uploads (days from upload / last material change).
   * Changing this recomputes expiresAt and queues overdue files for deletion.
   */
  documentRetentionDays: number;
  allowPremiumModels: boolean;
  requireHumanReview?: boolean;
  /**
   * When true, signup uses one-click credential generation (hides terms + Create account).
   * When false, standard email/password + terms flow.
   */
  allowAutogenerateAccounts?: boolean;
  /** When set, overrides MOCK_OPENROUTER env for the running process. */
  mockOpenRouter?: boolean;
}

/** Queued project document deletions driven by retention policy. */
export interface DocDeletionQueueItem {
  id: string;
  projectId: string;
  docId: string;
  docName: string;
  reason: "retention_expired" | "policy_recompute";
  expiresAt: string;
  queuedAt: string;
  status: "pending" | "deleted" | "failed";
  error?: string;
  deletedAt?: string;
}

/** Which product path produced the spend. */
export type CostChannel = "doctrine" | "docs" | "i18n" | "lifecycle" | "other";

/** Whether the USD figure is OpenRouter-billed or a local estimate. */
export type CostSource = "openrouter" | "estimate" | "mixed";

export interface CostEntry {
  id: string;
  at: string;
  model: string;
  tokens: number;
  costUsd: number;
  sessionId?: string;
  label: string;
  /** True when the call used the operator premium model route. */
  premium?: boolean;
  /** Originating pipeline / feature. */
  channel?: CostChannel;
  /** openrouter = billed by API; estimate = local MODEL_RATES fallback. */
  costSource?: CostSource;
  /** OpenRouter generation id(s) when available. */
  generationId?: string;
}

export interface MailingSubscriber {
  id: string;
  email: string;
  name?: string;
  source: "landing" | "import" | "operator";
  status: "active" | "unsubscribed";
  consentedAt: string;
  unsubscribedAt?: string;
  updatedAt: string;
}

export type MarqueeKind = "power" | "systems" | "narrative" | "proc";

export interface MarqueeItem {
  id: string;
  badge: string;
  kind: MarqueeKind;
  text: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
}

export type ExportFormat = "html" | "pdf" | "docx" | "pptx";

export interface ExportTemplate {
  id: string;
  name: string;
  description?: string;
  subjectPreset?: string;
  campaignSubject?: string;
  htmlBody: string;
  supportsFormats: ExportFormat[];
  sortOrder: number;
  enabled: boolean;
  imported: boolean;
  sourceFile?: string;
  assetDir?: string;
  previewText?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportJob {
  id: string;
  templateId: string;
  briefId: string;
  sessionId?: string;
  format: ExportFormat;
  status: "pending" | "completed" | "failed";
  outputFile?: string;
  error?: string;
  mock: boolean;
  createdAt: string;
  completedAt?: string;
}

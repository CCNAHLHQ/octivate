import type {
  CapturePassportBlock,
  CapturePipelineHints,
  CaptureRegistryBlock,
} from "@/lib/sources/capture-descriptors";

export type EvidenceChannelKind = "html" | "ocr" | "upload" | "summary" | "capture_text";

export type EvidenceChannel = {
  kind: EvidenceChannelKind;
  text: string;
  confidence: number;
  extractedAt: string;
  path?: string;
  bytes?: number;
  notes?: string;
};

export type DocumentLabelKind = "psn" | "sector" | "relevance" | "custom";

export type DocumentLabel = {
  kind: DocumentLabelKind;
  value: string;
  weight: number;
  method: "rule" | "model";
  hitCount?: number;
};

export type EvidenceDocument = {
  id: string;
  sourceId?: string;
  projectId?: string;
  title: string;
  url?: string;
  text: string;
  sha256?: string;
  channels: EvidenceChannel[];
  labels: DocumentLabel[];
  routes: string[];
  registry?: CaptureRegistryBlock;
  passport?: CapturePassportBlock;
  pipeline?: CapturePipelineHints;
  captureFolder?: string;
  capturedAt?: string;
  createdAt: string;
};

export type ScoringPolicy = {
  sourceScoreW: number;
  labelMatchW: number;
  agentConfW: number;
  triangulationW: number;
  freshnessW: number;
  /** Operator default for project-run “local sources only” toggle. */
  localOnlySourcesDefault?: boolean;
};

export const DEFAULT_SCORING_POLICY: ScoringPolicy = {
  sourceScoreW: 25,
  labelMatchW: 20,
  agentConfW: 30,
  triangulationW: 15,
  freshnessW: 10,
  localOnlySourcesDefault: false,
};

export type BriefScoreBreakdown = {
  total: number;
  parts: {
    sourceScore: number;
    labelMatch: number;
    agentConf: number;
    triangulation: number;
    freshness: number;
  };
  policy: ScoringPolicy;
};

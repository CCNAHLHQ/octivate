export type CountryCode = "TT" | "GY" | "BB" | "JM";
export type MediaPlatform = "vimeo" | "direct";
export type MediaJobStage =
  | "queued"
  | "downloading"
  | "downloaded"
  | "transcribing"
  | "done"
  | "failed"
  | "cancelled"
  | "held";
export type PipelineControlState = "idle" | "running" | "paused" | "cancelling";
export type AsrProvider = "auto" | "openrouter" | "local";
export type ProgressPhase =
  | "idle"
  | "download"
  | "extract"
  | "asr"
  | "finalize"
  | "retry";

export type CrawlSeed = {
  id: string;
  url: string;
  label: string;
  country: CountryCode;
  enabled: boolean;
  kind: "vimeo_showcase" | "site_pages";
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type MediaCandidate = {
  id: string;
  country: CountryCode;
  title: string;
  pageUrl: string;
  mediaUrl: string;
  platform: MediaPlatform;
  vimeoId?: string;
  chamber?: string;
  discoveredAt: string;
  warnings: string[];
  durationSec?: number;
  connectorVersion: string;
};

export type MediaJob = {
  id: string;
  candidateId: string;
  country: CountryCode;
  title: string;
  pageUrl: string;
  mediaUrl: string;
  platform: MediaPlatform;
  vimeoId?: string;
  stage: MediaJobStage;
  progressPct: number;
  progressPhase?: ProgressPhase;
  progressLabel?: string;
  bytesDownloaded?: number;
  bytesTotal?: number;
  /** Instantaneous download throughput (bytes/sec) while transferring. */
  bytesPerSec?: number;
  retryCount?: number;
  asrProvider?: "openrouter" | "local";
  folder?: string;
  videoPath?: string;
  audioPath?: string;
  /** Short operator-facing headline (never a stack dump). */
  error?: string;
  /** Full diagnostic text for expand/copy (truncated at write time). */
  errorDetail?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationSec?: number;
  /** Estimated wall-clock seconds for remaining ASR (model RTF). */
  estimateAsrSec?: number;
  estimateTotalSec?: number;
  transcriptStatus?: "not_applicable" | "octivate_machine_transcript";
  model?: string;
  warnings: string[];
};

export type AutomationSettings = {
  /** How many catalogued items become queued jobs this run (slider). */
  batchSize: number;
  maxRetries: number;
  asrProvider: AsrProvider;
  updatedAt: string;
};

export type PipelineState = {
  control: PipelineControlState;
  discoverDone: boolean;
  lastError?: string;
  updatedAt: string;
  startedAt?: string;
};

export type PipelineSummary = {
  control: PipelineControlState;
  found: number;
  held: number;
  queued: number;
  downloading: number;
  downloaded: number;
  transcribing: number;
  done: number;
  failed: number;
  cancelled: number;
  active: number;
  jobs: number;
  seedsEnabled: number;
  seedsTotal: number;
  estimateAsrSec: number;
  batchSize: number;
  discoverDone: boolean;
  lastError?: string;
  updatedAt: string;
};

export type MediaMetaFile = {
  mediaId: string;
  title: string;
  country: CountryCode;
  platform: MediaPlatform;
  pageUrl: string;
  mediaUrl: string;
  folder: string;
  videoFile?: string;
  contentHash?: string;
  durationSec?: number;
  discoveredAt: string;
  downloadedAt?: string;
  transcribedAt?: string;
  transcriptStatus: "not_applicable" | "octivate_machine_transcript";
  model?: string;
  asrProvider?: string;
  connectorVersion: string;
  warnings: string[];
};

export const CONNECTOR_VERSION = "parl-media-v4";

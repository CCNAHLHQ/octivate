/**
 * Deterministic fixture for local evidence + citation engine checks.
 * Used by scripts/test-local-evidence.mjs — not production seed data.
 */
import type { EvidenceDocument } from "@/lib/evidence/types";
import type { BriefCitedSource, Project, Source } from "@/lib/types";

export const FIXTURE_QUESTION =
  "How will the electricity tariff reform affect industrial competitiveness in Barbados?";

export const FIXTURE_PROJECT: Project = {
  id: "proj_fixture_local_evd",
  name: "Barbados energy theatre",
  country: "Barbados",
  sector: "Energy",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  documents: [
    {
      id: "doc_fixture_upload",
      name: "industrial-competitiveness-memo.txt",
      type: "text/plain",
      size: 400,
      uploadedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};

export const FIXTURE_SOURCES: Source[] = [
  {
    id: "src_capture_fixture",
    title: "Barbados Fair Trading Commission — tariff decision summary",
    tier: 1,
    country: "Barbados",
    type: "Regulator",
    health: "healthy",
    lastChecked: "2026-01-01T00:00:00.000Z",
    lastCaptureAt: "2026-01-01T00:00:00.000Z",
    lastCaptureFolder: "fixture-capture",
    sectorTags: ["Energy", "Regulation"],
    psnLayers: ["Power", "Systems"],
    userRelevance: ["tariff", "electricity"],
    watchPriority: "Core",
    retrievalPriority: "High",
    totalSourceScore: 88,
  },
  {
    id: "parl_vimeo_999001",
    title: "House debate on energy subsidy reform",
    tier: 2,
    country: "Barbados",
    type: "Parliamentary video transcript",
    health: "healthy",
    lastChecked: "2026-01-01T00:00:00.000Z",
    lastCaptureAt: "2026-01-01T00:00:00.000Z",
    lastCaptureFolder: "fixture-parl",
    lastCaptureRoutes: ["parliamentary-video"],
    sectorTags: ["Parliamentary", "Energy"],
    psnLayers: ["Power", "Narratives"],
    watchPriority: "Secondary",
    retrievalPriority: "High",
  },
  {
    id: "src_registry_only",
    title: "Generic Caribbean outlook blog",
    tier: 4,
    country: "Barbados",
    type: "Blog",
    url: "https://example.invalid/outlook",
    health: "healthy",
    lastChecked: "2026-01-01T00:00:00.000Z",
    sectorTags: ["Energy"],
    psnLayers: ["Narratives"],
    watchPriority: "Secondary",
    retrievalPriority: "Low",
    totalSourceScore: 40,
  },
];

const CAPTURE_TEXT = `
The Fair Trading Commission approved a staged electricity tariff reform for industrial customers.
Industrial competitiveness depends on predictable energy costs over a 24-month glide path.
The decision notes that manufacturers face margin pressure if peak tariffs rise faster than regional peers.
`.trim();

const PARL_TEXT = `
Members debated electricity tariff reform and the impact on industrial competitiveness in Barbados.
The minister argued that subsidy redesign must protect exporters while closing fiscal gaps.
Opposition members warned that abrupt tariff increases would weaken factory utilisation.
`.trim();

const UPLOAD_TEXT = `
Internal memo: electricity tariff reform will reshape industrial competitiveness for Barbados exporters.
Recommend hedging energy contracts and tracking Fair Trading Commission implementation milestones.
`.trim();

export const FIXTURE_EVIDENCE: EvidenceDocument[] = [
  {
    id: "evd_capture",
    sourceId: "src_capture_fixture",
    projectId: FIXTURE_PROJECT.id,
    title: FIXTURE_SOURCES[0].title,
    text: CAPTURE_TEXT,
    channels: [
      {
        kind: "capture_text",
        text: CAPTURE_TEXT,
        confidence: 0.9,
        extractedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    labels: [
      { kind: "sector", value: "Energy", weight: 0.8, method: "rule", hitCount: 2 },
      { kind: "relevance", value: "tariff", weight: 0.7, method: "rule", hitCount: 2 },
    ],
    routes: ["html-capture"],
    captureFolder: "fixture-capture",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "evd_parl",
    sourceId: "parl_vimeo_999001",
    projectId: FIXTURE_PROJECT.id,
    title: FIXTURE_SOURCES[1].title,
    text: PARL_TEXT,
    channels: [
      {
        kind: "summary",
        text: PARL_TEXT,
        confidence: 0.55,
        extractedAt: "2026-01-01T00:00:00.000Z",
        notes: "octivate_machine_transcript",
      },
    ],
    labels: [
      { kind: "custom", value: "octivate_machine_transcript", weight: 1, method: "rule" },
      { kind: "relevance", value: "electricity", weight: 0.6, method: "rule", hitCount: 1 },
    ],
    routes: ["parliamentary-video"],
    captureFolder: "fixture-parl",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "evd_upload",
    sourceId: `upload_${FIXTURE_PROJECT.id}_doc_fixture_upload`,
    projectId: FIXTURE_PROJECT.id,
    title: "industrial-competitiveness-memo.txt",
    text: UPLOAD_TEXT,
    channels: [
      {
        kind: "upload",
        text: UPLOAD_TEXT,
        confidence: 0.7,
        extractedAt: "2026-01-01T00:00:00.000Z",
        notes: "project_upload_extract",
      },
    ],
    labels: [
      { kind: "relevance", value: "competitiveness", weight: 0.7, method: "rule", hitCount: 1 },
    ],
    routes: ["project-upload"],
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

export const FIXTURE_CITED_BASE: BriefCitedSource[] = [
  {
    id: "src_capture_fixture",
    label: "Source 1",
    title: FIXTURE_SOURCES[0].title,
    passageCount: 0,
  },
  {
    id: "parl_vimeo_999001",
    label: "Source 2",
    title: FIXTURE_SOURCES[1].title,
    passageCount: 0,
  },
  {
    id: "src_registry_only",
    label: "Source 3",
    title: FIXTURE_SOURCES[2].title,
    snippet: "Generic Caribbean outlook without local text",
    passageCount: 0,
  },
];

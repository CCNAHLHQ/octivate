/**
 * Wales Gas-to-Energy regression fixture (synthetic excerpts).
 * Encodes the 18 Aug 2026 acceptance cases without committing PDF binaries.
 */
import type { EvidenceClaim, Project, Trend } from "@/lib/types";

export const WALES_AS_OF = "2026-08-18";

export const WALES_QUESTION =
  "Should a Caribbean energy equipment and services supplier invest resources over the next 12 months to position for remaining and connected opportunities arising from the Wales Gas-to-Energy programme?";

export const WALES_PROJECT: Project = {
  id: "proj_wales_gas_fixture",
  name: "Wales Gas to Energy project",
  country: "Guyana",
  sector: "Energy",
  question: WALES_QUESTION,
  documents: [
    {
      id: "doc_wales_eoi",
      name: "Wales-EOI-deadline-15-May-2026.txt",
      type: "text/plain",
      uploadedAt: "2026-04-01T10:00:00.000Z",
    },
    {
      id: "doc_wales_rfp",
      name: "NGL-OM-RFP-issued.txt",
      type: "text/plain",
      uploadedAt: "2026-03-15T10:00:00.000Z",
    },
    {
      id: "doc_wales_award",
      name: "later-award-notice.txt",
      type: "text/plain",
      uploadedAt: "2026-07-01T10:00:00.000Z",
    },
  ],
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-08-18T10:00:00.000Z",
  status: "active",
};

/** Claims that mirror dated Wales evidence for temporal resolver tests. */
export const WALES_CLAIMS: EvidenceClaim[] = [
  {
    claim_id: "claim_eoi_deadline",
    statement:
      "Expression of Interest (EOI) for Wales Gas-to-Energy supplier positioning closes with deadline 15 May 2026.",
    source_ids: ["upload_wales_eoi"],
    judgement_type: "fact",
    decision_relevance: "EOI timing for supplier positioning",
    confidence: "high",
    evidence_ids: ["ev_eoi"],
    component: "eoi",
    deadlineAt: "2026-05-15",
    issuedAt: "2026-04-01",
    eventDate: "2026-04-01",
  },
  {
    claim_id: "claim_rfp_issued",
    statement:
      "NGL Operations & Maintenance RFP document was issued for the Wales Gas-to-Energy programme.",
    source_ids: ["upload_wales_rfp"],
    judgement_type: "fact",
    decision_relevance: "RFP issuance is not proof of current open status",
    confidence: "moderate",
    evidence_ids: ["ev_rfp"],
    component: "ngl_om_rfp",
    issuedAt: "2026-03-15",
    eventDate: "2026-03-15",
  },
  {
    claim_id: "claim_award_later",
    statement:
      "Preferred bidder selected and award notice published for NGL O&M package, superseding prior open-RFP assumptions.",
    source_ids: ["upload_wales_award"],
    judgement_type: "fact",
    decision_relevance: "Later award supersedes open-RFP state",
    confidence: "high",
    evidence_ids: ["ev_award"],
    component: "ngl_om_rfp",
    lifecycleState: "awarded",
    eventDate: "2026-07-01",
    observedAt: "2026-07-01",
  },
];

export const WALES_TRENDS: Trend[] = [
  {
    id: "tr_tt_lng",
    title: "Trinidad LNG — Atlantic train utilization",
    country: "Trinidad & Tobago",
    sector: "Energy",
    summary: "Atlantic LNG train utilization trends in Trinidad & Tobago.",
    severity: "medium",
    publishedAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "tr_gy_wales",
    title: "Guyana Wales Gas-to-Energy commissioning watch",
    country: "Guyana",
    sector: "Energy",
    summary: "Wales power plant commissioning and NGL offtake timing in Guyana.",
    severity: "high",
    publishedAt: "2026-07-15T00:00:00.000Z",
  },
  {
    id: "tr_jm_re",
    title: "Jamaica renewables procurement round",
    country: "Jamaica",
    sector: "Energy",
    summary: "Utility-scale renewables RFP activity in Jamaica.",
    severity: "low",
    publishedAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "tr_caricom_energy",
    title: "CARICOM regional energy security dialogue",
    country: "CARICOM",
    sector: "Energy",
    summary: "Regional energy security dialogue mentioning Guyana Wales interconnection themes.",
    severity: "medium",
    publishedAt: "2026-06-20T00:00:00.000Z",
  },
];

export const WALES_SCRATCHPAD_GAPS = [
  "Actually re-reading the EIA, there may be a theatre mismatch with Trinidad.",
  "Let me check whether the RFP is still open.",
  "Current NGL O&M status not verified against an authoritative award notice.",
  "No source provides investment positioning analysis",
];

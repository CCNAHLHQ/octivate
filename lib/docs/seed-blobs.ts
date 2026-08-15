import fs from "fs/promises";
import { documentBlobPath, projectUploadDir } from "@/lib/docs/paths";

/**
 * On-disk bodies for seed / demo project documents.
 * Seed rows in projects.json historically carried metadata only — summarizer
 * then reported "content not stored on disk". Hydrate lazily on first read.
 */
const SEED_BLOBS: Record<
  string,
  { projectId: string; mime: string; body: string }
> = {
  doc_ai_1: {
    projectId: "proj_tt_ai_governance",
    mime: "text/markdown",
    body: `# MPAAI — National AI Initiatives (working note)

**Theatre:** Trinidad and Tobago · Public administration / Artificial Intelligence  
**Owner:** Ministry of Public Administration and Artificial Intelligence (MPAAI)  
**Horizon:** decisions through 2027  
**Status:** internal synthesis for decision support (fixture corpus)

## Purpose
This note summarises the national AI governance track that MPAAI is coordinating with UNESCO (Readiness Assessment Methodology — RAM) and UNDP (AI Landscape Assessment — AILA). It is intended to ground lock-now versus defer choices for public-service AI deployment.

## Institutional map
- **Convening authority:** MPAAI — National AI Governance Framework drafting and cross-ministry coordination.
- **Centre of government:** Office of the Prime Minister — political cover for high-stakes public AI pilots.
- **Rights / accountability:** Data protection authority — sequencing of privacy, lawful basis, and automated decision safeguards.
- **Validation / academia:** UWI and partner researchers — RAM validation workshops and independent challenge function.
- **Delivery ministries:** Health, education, social services, and revenue — early demand for AI-assisted casework and service routing.

## UNESCO RAM (Trinidad and Tobago)
RAM frames readiness across legal/regulatory, social/cultural, scientific/educational, economic, and technical/infrastructure dimensions.
Observed emphasis in the T&T track:
1. **Legal / regulatory gap:** AI-specific rules are thin; reliance on general data-protection and sector statutes creates ambiguity for high-risk systems.
2. **Institutional capacity:** Coordination exists at MPAAI, but line ministries lack shared evaluation criteria for vendors and model risk.
3. **Skills & legitimacy:** Public trust narratives (fairness, jobs, sovereignty) are under-specified relative to procurement pace.
4. **Infrastructure:** Shared data estates and secure hosting patterns are uneven; cloud vs on-prem trade-offs remain unresolved for sensitive registers.

## UNDP AILA
AILA focuses on landscape maturity: who is building, buying, and governing AI, and where capacity bottlenecks sit.
Key AILA-aligned findings for operators:
- Procurement language often treats AI as ordinary software; evaluation does not force disclosure of training data provenance, human oversight, or fallback procedures.
- Donor-supported pilots risk creating parallel stacks unless MPAAI publishes a single assurance path.
- Regional Caribbean peer learning (CARICOM digital agenda) is an opportunity if T&T locks interoperable assurance language early.

## Risks through 2027
**Political / legitimacy:** Rapid citizen-facing AI without transparent redress can reverse political capital for the national framework.  
**Regulatory:** Deploying high-risk decision support before data-protection sequencing invites compliance debt and litigation exposure.  
**Institutional:** Fragmented pilots without shared audit capacity leave MPAAI unable to enforce framework rules.  
**Opportunity:** Locking a proportionate assurance ladder (low / medium / high risk) now unlocks safer scale in health and social services while RAM/AILA recommendations are still politically salient.

## Lock now vs defer
### Lock now
1. Data-protection sequencing and DPIA triggers for automated decisions affecting rights or benefits.
2. Minimum procurement disclosures (model purpose, oversight, fallback, vendor audit rights).
3. A single MPAAI assurance registry for public-sector AI pilots above a risk threshold.
4. Independent challenge capacity (academic / civil society) for high-risk systems.

### Defer (explicitly)
1. Hard AI-specific statute before RAM recommendations and Cabinet adoption path are clear — prefer interim instruments.
2. Nationwide high-autonomy case adjudication — keep humans in the loop until assurance registry is live.
3. Cross-border sensitive register hosting until sovereignty and contractual audit terms are settled.

## Monitoring through 2027
- Gazette / Cabinet notes on AI framework adoption.
- UNESCO RAM country deliverables and public summaries.
- UNDP AILA follow-on capacity plans.
- Parliamentary questions on automated decision-making in public services.
- Data protection authority guidance on AI / profiling.

## Gaps acknowledged in this note
- Exact RAM dimension scores not attached to this working extract.
- Line-ministry pilot inventories are incomplete.
- Budget lines for assurance / audit capacity remain indicative only.
`,
  },
  doc_ai_2: {
    projectId: "proj_tt_ai_governance",
    mime: "text/markdown",
    body: `# UNESCO AI Readiness — Trinidad and Tobago (operator digest)

**Source class:** UNESCO Readiness Assessment Methodology (RAM) country track  
**Companion:** UNDP AI Landscape Assessment (AILA)  
**Use:** evidence for public-service AI deployment decisions through 2027

## Executive readout
Trinidad and Tobago's RAM engagement shows **policy intent ahead of operational assurance**. The national conversation is active under MPAAI, but readiness is uneven: legal instruments lag procurement interest, and legitimacy work with the public is thinner than technical ambition.

## Dimension highlights (qualitative)
| Dimension | Readiness signal | Operator implication |
| --- | --- | --- |
| Legal / regulatory | Emerging | Do not treat silence as permission for high-risk automation |
| Social / cultural | Contested | Invest in redress and explainability narratives early |
| Scientific / educational | Moderate | Use UWI / academic validators as challenge function |
| Economic | Opportunity-led | Tie AI spend to measurable service outcomes, not vanity pilots |
| Technical / infrastructure | Uneven | Shared hosting and identity/data standards before scale |

## UNDP AILA intersection
AILA reinforces that **buyers outpace governors**. Ministries can purchase models faster than they can staff evaluation, monitoring, or incident response. That asymmetry is the core institutional risk through 2027.

## Political risks
- Framing AI as inevitable modernisation without consent pathways.
- Partisan capture of "AI success stories" before independent evaluation exists.
- Over-reliance on external vendors for sovereign registers.

## Regulatory risks
- Automated benefit / compliance decisions without clear lawful basis and appeal.
- Cross-ministry data sharing for model training without retention and purpose limits.
- Sector regulators (health, finance, telecom) not aligned on AI incident reporting.

## Opportunities
- Use RAM/AILA momentum to lock a **risk-tiered assurance ladder** while Cabinet attention is high.
- Position T&T as a Caribbean reference for proportionate public AI governance.
- Pair procurement reform with skills pathways so local firms can meet assurance requirements.

## Decisions
**Lock now:** DPIA + human oversight rules for rights-impacting systems; vendor disclosure minima; MPAAI pilot registry.  
**Defer:** Full AI Act-style statute; fully automated adjudication; sensitive cross-border hosting.

## Evidence caveats
This digest is a decision-support synthesis for Octivate fixtures. Operators should re-check against the latest UNESCO/UNDP published country materials when available.
`,
  },
  doc_ai_3: {
    projectId: "proj_tt_ai_governance",
    mime: "text/markdown",
    body: `# UWI — RAM validation workshop notes

**Event:** Academic validation workshop on UNESCO RAM findings (Trinidad and Tobago)  
**Hosts:** UWI researchers with MPAAI observers  
**Focus:** challenge function for national AI governance claims

## Workshop consensus
1. RAM is useful as a **diagnostic**, not a blank cheque for deployment.
2. Public-service AI should be gated by **risk class**, with high-risk systems requiring independent review.
3. Data protection sequencing is a prerequisite, not a parallel workstream.
4. Caribbean peer comparison helps, but copy-paste regulation from larger jurisdictions will fail locally without capacity funding.

## Challenge points raised
- Missing inventory of live and planned AI pilots across ministries.
- Ambiguous ownership of model incident response.
- Weak articulation of citizen redress when automated decisions go wrong.
- Vendor contracts lacking audit and termination-for-cause on safety failures.

## Recommendations to operators
- Fund a standing **independent review panel** (academia + civil society + technical) for high-risk pilots.
- Require ministries to publish a plain-language decision notice when AI materially affects a citizen outcome.
- Treat UWI validation as recurring (annual), not one-off optics.

## Lock vs defer (workshop framing)
Lock the assurance and redress basics now. Defer maximalist statutory packages until after at least one annual validation cycle against real pilots.
`,
  },
  doc_2: {
    projectId: "proj_guyana_energy",
    mime: "text/markdown",
    body: `# Guyana Local Content Act — operator notes (fixture)

## Scope
Local content obligations for petroleum and related midstream activity, including contractor preference, reporting, and compliance monitoring.

## Decision relevance (through 2028)
- Midstream LNG / logistics investors must sequence partner selection behind verifiable Tier-1 / Tier-2 capacity.
- Non-compliance risk is both regulatory (penalties, permit friction) and political (resource nationalism narratives).

## Lock now
- Map eligible local contractors early; document gaps honestly.
- Align EPC / O&M contracting language with Local Content Act reporting duties.

## Defer
- Assuming waivers will be routine for specialised midstream packages without evidence.
`,
  },
};

/** Write seed blob if missing. Returns true when bytes are available after ensure. */
export async function ensureSeedDocumentBlob(
  projectId: string,
  docId: string
): Promise<{ ok: boolean; size?: number; mime?: string }> {
  const seed = SEED_BLOBS[docId];
  if (!seed || seed.projectId !== projectId) return { ok: false };

  const target = documentBlobPath(projectId, docId);
  try {
    const existing = await fs.readFile(target);
    if (existing.length > 0) return { ok: true, size: existing.length, mime: seed.mime };
  } catch {
    /* create below */
  }

  await fs.mkdir(projectUploadDir(projectId), { recursive: true });
  const bytes = Buffer.from(seed.body, "utf8");
  await fs.writeFile(target, bytes);
  return { ok: true, size: bytes.length, mime: seed.mime };
}

export function isSeedDocumentId(docId: string): boolean {
  return Object.prototype.hasOwnProperty.call(SEED_BLOBS, docId);
}

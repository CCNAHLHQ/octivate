# PRD — Source Evidence → Label → Brief Pipeline

**Status:** Implemented (v1 foundation through UI/ops)  
**Date:** 2026-08-01  
**Default model:** `nvidia/nemotron-3-super-120b-a12b:free` (paid override via operator allow + project toggle)  
**Companion canvas:** `evidence-pipeline-prd.canvas.tsx`

### Locked decisions
1. Ship P0–P5 in one delivery pass (schema → OCR text-layer → labels → router → brief UI → ops).
2. Extract order: PDF/DOCX text-layer first (`pdf-parse` / `mammoth`); image OCR deferred as a later channel.
3. Paid model: unlocked by `OperatorLimits.allowPremiumModels`; per-run project checkbox `usePaidModel` (default free).

---

## 1. Problem

We capture source pages and curate rich keyword indicators (sector tags, PSN layers, user relevance), but:

1. Capture artifacts are **not consumed** by the doctrine brief pipeline.
2. Uploaded PDFs/DOCX have **no OCR / real extract**.
3. Keyword indicators label **sources**, not **documents**.
4. Brief confidence weights are **hardcoded**; cited-source UX is dense.
5. Operator control / audit coverage for this path is incomplete.

This PRD defines an end-to-end, future-proof pipeline so capture → OCR → local labeling → model-routed PSN analysis → scored brief → export/review, with operator fine-tuning.

---

## 2. Goals

| Goal | Outcome |
|------|---------|
| Unified evidence | Capture HTML + OCR/extract + uploads live in one `EvidenceDocument` |
| Local labeling | Curator keyword indicators applied as `DocumentLabel[]` (rules-first) |
| Model routing | Nemotron free by default; paid switch when allowed |
| Context binding | Strategic question + doc summaries + labeled evidence guide PSN agents |
| Brief quality | Configurable scoring weights; accurate cites from local + registry |
| SaaS UI | Modular brief cards, collapsible dense text, minimal cites, lighting-aware |
| Ops | Operator board for taxonomy/OCR/scores/models + audit + reports |
| Export lifecycle | Quick export only when brief exists; hidden during run/rerun |

### Non-goals (v1)

- Full-site crawls / site maps  
- Audio/video ASR (keep question voice dictation only)  
- Replacing doctrine agent graph (extend `DoctrineAgentName` / workflow.yaml; “DECTREE” is product language only)  
- Realtime collaborative brief editing  
- Public source marketplace  

---

## 3. High-level architecture

```
L0 Curate          L1 Ingest              L2 Normalize           L3 Route            L4 Analyze           L5 Deliver
─────────────      ──────────────────     ─────────────────      ──────────────      ────────────────     ────────────────
Source curate  →   Page capture      →    Unified document  →   Model router   →   PSN agents      →   Brief cards
(tags/PSN/URL)     (+ OCR/extract)        Local labeling         Context pack       Score & weight      Human review
                                                                                                         Operator control
```

**Complexity (relative):** OCR/extract and PSN agent integration = **High**; schema/wiring/router = **Low–Med**.

See interactive DAG in the companion canvas.

---

## 4. Gaps vs current codebase

| Gap | Today | v1 requirement |
|-----|-------|----------------|
| Capture → evidence | Artifacts unused by agents | Evidence manager loads latest capture text + `pipeline.routes` |
| OCR / binary extract | UTF-8 sniff / binary stub | PDF/image OCR + DOCX text into same doc model |
| Keyword indicators | Source chips only | `DocumentLabel[]` from taxonomy + rules |
| Unified document | Capture ≠ ProjectDocument | `EvidenceDocument` + channels |
| Confidence weights | Hardcoded map | `ScoringPolicy` + breakdown UI |
| APPROVED_DELIVERY | Review not gated | Enforce before final / premium export |
| Audit | Sparse for models/marquee/etc. | `appendAudit` on fine-tunes + pipeline events |
| Quick export | Shown if `linkedBriefId` | Hide while session running; bind newest brief |
| Cited sources UX | Dense list | Minimal row + open URL + local artifact |
| Project marquee | Static `BrandBackdrop` | Animated watermark + PSN-kind marquee |

---

## 5. Core objects

### `EvidenceDocument`
Single unit for capture + OCR + upload.

- `id`, `sourceId?`, `projectId?`
- `channels: EvidenceChannel[]` — `html | ocr | upload | summary`
- `text` (merged), `sha256`, `labels: DocumentLabel[]`, `routes: string[]`
- `registry?`, `passport?` (from capture descriptors)

### `DocumentLabel`
- `kind: psn | sector | relevance | custom`
- `value`, `weight`, `method: rule | model`, `evidenceSpans?`

### `LabelTaxonomy` (operator-editable)
Seeded from Curate Source: `psnLayers`, `sectorTags`, `userRelevance` + synonyms.

### `ScoringPolicy` (defaults sum to 100)
| Factor | Default |
|--------|---------|
| Source registry scores | 25 |
| Label match to Q/sector | 20 |
| Agent confidence | 30 |
| Triangulation | 15 |
| Freshness (capture/check age) | 10 |

### `ModelRoutePolicy`
- Default free Nemotron Super  
- Paid override when `OperatorLimits.allowPremiumModels`  
- Feature classes: `pipeline | docs | label`  
- Persist on `AgentSession`

---

## 6. Stage requirements

| Stage | Requirement | Audit action |
|-------|-------------|--------------|
| L0 Curate | Tags seed taxonomy | `source_updated` |
| L1 Capture | Stamp registry/passport/pipeline (already) | `source_captured` |
| L1 OCR | Extract/OCR → channels | `evidence_ocr_completed` |
| L2 Unify | One schema across capture + project docs | `evidence_unified` |
| L2 Label | Rules-first local labeler | `evidence_labeled` |
| L3 Router | Free default / paid switch | `model_route_applied` |
| L3 Context | Q + summaries + labeled evidence + sources | `context_pack_built` |
| L4 PSN | Consume labels; cite evidence ids | `agent_stage_completed` |
| L4 Score | Apply `ScoringPolicy` | `brief_scored` |
| L5 Brief UI | Modular cards, PSN tabs, minimal cites | — |
| L5 Review/Export | Gate + quick-export lifecycle | `brief_reviewed` / `brief_exported` |
| L5 Operator | Evidence Pipeline board + reports | `ops_*_updated` |

---

## 7. UI / UX

### Brief page
- Modular cards (SaaS layout, lighting/theme tokens)
- Accordion for long executive / variants / evidence-gaps text
- Tabbed **Power / Systems / Narrative** (replace flat empty-feeling columns)
- Cited sources: name, open-URL icon, optional local artifact link, short cite line
- Score breakdown card tied to `ScoringPolicy`

### Project page
- Animated brand watermark + PSN-kind marquee
- Quick export: **only** with associated brief; **hide** during pipeline run/rerun; bind to newly generated brief; remove stale affordances

### Operator
- New **Evidence Pipeline** control module: taxonomy, OCR toggles, scoring weights, model route, yield reports (capture %, label coverage, cite hit-rate)
- All mutations: `appendAudit` + ops events

---

## 8. Delivery phases

| Phase | Ship | Risk |
|-------|------|------|
| **P0** Foundation | `EvidenceDocument` + wire capture into evidence agent | Low |
| **P1** Extract/OCR | PDF/DOCX text first; image OCR second | High |
| **P2** Local labeling | Taxonomy → `DocumentLabel`; operator editor | Med |
| **P3** Router + context | Free/paid switch; context pack | Low |
| **P4** Brief score + UI | Weights, PSN tabs, cites, cards, collapsibles | Med |
| **P5** Ops + chrome | Operator board, audit completeness, marquee, export lifecycle | Med |

**Build rule:** Do not start broad UI rewrites until P0 evidence wiring is live. P0∥P2 after schema lands.

---

## 9. Acceptance criteria (v1)

**Functional**

- [ ] Captured page text reachable by evidence manager  
- [ ] OCR/extract fills same `EvidenceDocument` as HTML channel  
- [ ] Labels from curator tags without LLM (rules)  
- [ ] Nemotron free default; paid switch audited  
- [ ] Brief cites registry URL + local artifact when present  
- [ ] Quick export hidden during pipeline run  

**Quality / ops**

- [ ] Confidence breakdown matches `ScoringPolicy`  
- [ ] Dense sections accordion by default  
- [ ] Operator retunes weights/taxonomy without redeploy  
- [ ] Audit on capture, OCR, label, route, score, review, export  
- [ ] Existing brief/project API contracts unbroken  
- [ ] Theme/lighting tokens honored on new cards  

---

## 10. Decision needed before build

1. Approve phase cut (all P0–P5 vs ship P0–P3 first).  
2. OCR stack preference for Windows deploy: e.g. `pdf-parse`/`mammoth` first; Tesseract/wasm or external OCR second.  
3. Whether project-level “Use paid model” is user-facing or operator-only in v1.

**Implementation starts at P0 after approval.**

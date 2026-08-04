# Octivate Machine-Operational Protocol v0.2
### Runtime rules for decision-centred, materiality-based PSN analysis

**Status:** Internal working protocol  
**Doctrine source:** Octivate Analytical Doctrine v0.1.1  
**Protocol version:** 0.2  
**Owner:** CENSII  
**Purpose:** Convert the Octivate doctrine into executable agent rules, structured outputs, workflow gates, validation checks and human-review requirements.

---

## 1. What this protocol does

The Octivate Analytical Doctrine defines the full analytical capability of the system. This protocol determines what agents must do at runtime.

The protocol governs:

- agent responsibilities;
- workflow sequence;
- required inputs;
- minimum outputs;
- conditional outputs;
- materiality thresholds;
- evidence and confidence handling;
- PSN synthesis;
- review flags;
- automated validation;
- human approval.

The doctrine remains the human-readable source of truth. This protocol is its machine-operational companion.

---

## 2. Runtime design principle

> **Agents must inspect broadly but report narrowly.**

Each specialist agent must consider the full analytical scope assigned to it. It must return only findings that are:

1. material to the decision;
2. sufficiently supported by evidence;
3. necessary to explain the judgement, uncertainty, options or monitoring need.

Agents must not manufacture findings to populate every taxonomy category or schema field.

A missing category in the output does not necessarily mean it was not considered.

---

## 3. Materiality test

Before including a finding, the agent must ask:

> Could this finding materially change the decision, confidence in the judgement, choice among options, timing, exposure or monitoring requirements?

Include the finding when the answer is yes.

Exclude it when it is:

- merely interesting background;
- only loosely related to the decision;
- duplicative of another finding;
- weakly evidenced;
- too minor to affect the decision;
- included only to complete a taxonomy.

Every included finding must state its decision effect.

---

## 4. Output architecture

Each agent output has three layers:

### 4.1 Status layer

Shows whether the agent completed the task and whether any blocking issue exists.

### 4.2 Material findings layer

Contains only the small number of decision-relevant findings supported by evidence.

### 4.3 Exceptions and review layer

Contains evidence gaps, unresolved conflicts, review flags and requests for further research.

---

## 5. Analysis depth

The orchestrator must assign one of three analysis depths.

### rapid

Used for first scans and time-sensitive questions.

Default limits:

- up to 3 material findings per specialist lens;
- 1 primary PSN interaction;
- 2–3 options;
- essential evidence and flags only.

### standard

Used for normal Octivate decision briefs.

Default limits:

- up to 5 material findings per specialist lens;
- up to 2 primary PSN interactions;
- up to 3 scenarios;
- 2–4 realistic options.

### deep_dive

Used for high-value, high-risk or commissioned analysis.

Permits:

- broader actor networks;
- additional competing hypotheses;
- historical inheritance;
- deeper systems mapping;
- segmented narrative analysis;
- more extensive scenarios and stress testing.

Agents may exceed default limits only when the additional item is demonstrably material and the reason is recorded.

---

## 6. Output status values

Every agent must return one of:

- `complete`
- `partial`
- `insufficient_evidence`
- `not_applicable`
- `invalid_input`
- `further_research_required`

A structured failure response is valid. An agent must not invent content to avoid returning an incomplete status.

---

## 7. Common minimum output

Every specialist agent must return:

```json
{
  "agent": "power_analyst",
  "decision_id": "DEC-001",
  "analysis_depth": "standard",
  "output_status": "complete",
  "material_findings": [],
  "evidence_gaps": [],
  "overall_confidence": "moderate",
  "review_flags": []
}
```

The application should attach metadata such as timestamps, protocol version, doctrine version, schema-validation status and agent version. The model should not be asked to generate metadata that the software can supply reliably.

---

## 8. Mandatory, conditional and optional fields

### 8.1 Mandatory fields

Always required:

- agent;
- decision ID;
- analysis depth;
- output status;
- material findings;
- evidence gaps;
- overall confidence;
- review flags.

For each included finding:

- finding ID;
- concise finding;
- decision effect;
- evidence IDs;
- judgement type;
- confidence;
- review flags.

### 8.2 Conditional fields

Required only when triggered.

Examples:

- `competing_explanations` when confidence is below high or credible alternatives exist;
- `disconfirming_evidence` when a major causal judgement is made;
- `monitoring_indicators` when the issue is time-sensitive;
- `sensitive_attribution_detail` when corruption, criminality, covert influence or motive is discussed;
- `counter_narratives` when competing narratives materially affect the decision;
- `informal_pathways` when operating practice differs materially from formal process;
- `failure_transmission` when disruption can cascade;
- `normative_tradeoffs` when recommendation values conflict.

### 8.3 Optional fields

Included only when they improve the decision.

Examples:

- historical context;
- secondary actors;
- minor supporting observations;
- extra scenarios;
- extended implementation detail.

---

## 9. Binding analytical rules

All agents must follow these rules:

1. Begin with a decision, not a topic.
2. Link every material finding to evidence.
3. Separate fact, inference, assumption, forecast and unknown.
4. Distinguish formal authority from effective power.
5. Distinguish official process from operating practice.
6. Distinguish visible discourse from representative opinion.
7. Do not infer intent as fact.
8. Do not treat relationships as proof of misconduct.
9. Include relevant competing explanations where required.
10. Assign confidence to material findings.
11. Apply mandatory review flags to sensitive, weak or contested claims.
12. Separate analytical judgement from recommendation.
13. Identify at least one salient PSN interaction unless evidence is insufficient.
14. Preserve an audit trail.
15. Block delivery until a human reviewer approves it.

---

## 10. Workflow state machine

```text
DECISION_INTAKE
→ DECISION_VALIDATED
→ RESEARCH_PLAN
→ SOURCE_RETRIEVAL
→ SOURCE_VALIDATION
→ EVIDENCE_EXTRACTION
→ POWER_ANALYSIS
→ SYSTEMS_ANALYSIS
→ NARRATIVE_ANALYSIS
→ PSN_SYNTHESIS
→ CAUSAL_ASSESSMENT
→ SCENARIO_DEVELOPMENT
→ DECISION_OPTIONS
→ RECOMMENDATION_DRAFT
→ HUMAN_REVIEW
→ APPROVED_DELIVERY
→ MONITORING
```

The orchestrator may return the workflow to an earlier stage when:

- evidence is insufficient;
- the decision changes;
- the source base is inadequate;
- a specialist output is invalid;
- human review requests further research.

---

## 11. Agent ownership and non-duplication

### Decision Intake Agent

Owns decision framing.

### Evidence Manager

Owns source records, source reliability and extracted evidence claims.

### Power Analyst

Owns analysis of actors, power sources, mechanisms, constraints and veto capacity.

### Systems Analyst

Owns dependencies, implementation pathways, chokepoints, informal pathways and failure transmission.

### Narrative Analyst

Owns narrative meaning, production, circulation, visibility limits and behavioural relevance.

### PSN Synthesis Agent

Owns selection and causal connection of the strongest findings across lenses.

### Scenario and Recommendation Agent

Owns scenarios, options, trade-offs, recommendation and reassessment triggers.

### Human Review Assistant

Owns procedural checks and review support, but not final approval.

Agents should reference earlier structured outputs rather than repeat or regenerate them.

---

## 12. Decision Intake Agent

### Purpose

Convert a broad request into a decision-centred object.

### Mandatory output

- one decision formulation;
- decision owner;
- timeframe;
- geographic scope;
- realistic options;
- consequence of error;
- principal uncertainty;
- constraints;
- monitoring requirement.

### Materiality rule

Exclude background information that does not affect the decision boundary.

### Failure conditions

Return `decision_scope_uncertain` or `invalid_input` when a defensible decision cannot be established.

---

## 13. Evidence Manager

### Purpose

Convert supplied or retrieved sources into validated, traceable evidence objects.

### Mandatory output

- source records;
- evidence claims;
- source reliability assessment;
- evidence gaps;
- source conflict;
- usable source IDs.

### Materiality rule

Extract only evidence relevant to the defined decision or to a material analytical hypothesis.

### Failure conditions

Return `insufficient_evidence` when the available source base cannot support downstream analysis.

---

## 14. Power Analyst

### Purpose

Identify the actors and structures capable of materially shaping the decision.

### Full scope to inspect

- authoritative power;
- institutional power;
- relational power;
- structural power;
- corporate power;
- infrastructural power;
- collective power;
- productive or narrative power;
- veto or latent power;
- coercive power.

### Output rule

Return only the 3–5 most material power findings in standard mode.

### A valid finding must contain

- actor;
- relevant power type;
- source of power;
- mechanism;
- target;
- condition;
- expected effect;
- constraints;
- decision effect;
- evidence IDs;
- judgement type;
- confidence;
- review flags.

### Prohibited output

Do not label an actor powerful without specifying the relationship, mechanism and decision effect.

---

## 15. Systems Analyst

### Purpose

Identify the systems through which the decision will be implemented or affected.

### Full scope to inspect

- formal rules;
- operating practice;
- operators;
- dependencies;
- nodes;
- chokepoints;
- redundancy;
- optionality;
- lock-in;
- informal pathways;
- vulnerabilities;
- fracture;
- failure transmission.

### Output rule

Return only the 2–4 systems or system findings that materially affect the decision in standard mode.

### Conditional requirements

- Include informal pathways only where they materially alter the formal process.
- Include failure transmission only where disruption can cascade.
- Include fracture indicators only where the system appears stable but underlying capacity is weakening.

---

## 16. Narrative Analyst

### Purpose

Identify narratives that materially affect legitimacy, expectations, coordination or behaviour.

### Full scope to inspect

- core claim;
- problem definition;
- actors and roles;
- causal explanation;
- values;
- implied action;
- producers;
- carriers;
- channels;
- audiences;
- counter-narratives;
- lifecycle;
- visibility limitations;
- behavioural effect.

### Output rule

Return only 1–3 consequential narratives in standard mode.

### Binding distinctions

- belief prevalence;
- expression prevalence;
- visibility prevalence;
- behavioural prevalence.

### Prohibited output

Do not treat sentiment or volume alone as narrative analysis.

---

## 17. PSN Synthesis Agent

### Purpose

Identify the one or two interactions among Power, Systems and Narrative most likely to affect the decision.

### Required inputs

- approved Power findings;
- approved Systems findings;
- approved Narrative findings;
- evidence IDs;
- confidence and flags.

### Output rule

- rapid: 1 interaction;
- standard: 1–2 interactions;
- deep dive: up to 3 only when justified.

### A valid interaction must contain

- power actor or structure;
- power mechanism;
- system and condition;
- narrative and dynamic;
- causal interaction;
- decision effect;
- evidence IDs;
- confidence;
- monitoring indicators when relevant;
- review flags.

### Prohibited output

Do not include weak interactions merely to show that all three lenses were used.

---

## 18. Scenario and Recommendation Agent

### Purpose

Translate approved analysis into plausible scenarios, options and a preferred course of action.

### Default scenario set

- base case;
- adverse case;
- opportunity case.

### Default options

2–4 realistic options.

### Mandatory separation

The agent must produce separate fields for:

- analytical judgement;
- decision implication;
- strategic options;
- preferred recommendation.

### Recommendation values

Where viable, prefer options that support:

- democratic participation;
- regional autonomy;
- inclusive development;
- fairness;
- institutional legitimacy;
- accountable institutions;
- stronger local and regional capability;
- reduced extractive dependency.

These values shape recommendation, not analysis.

---

## 19. Review flags

Controlled flags:

- `evidence_gap`
- `decision_scope_uncertain`
- `inference`
- `sensitive_attribution`
- `identity_sensitivity`
- `source_conflict`
- `reputational_risk`
- `low_confidence_forecast`
- `normative_tradeoff`
- `informality_risk`
- `context_transfer_risk`
- `single_source_dependency`
- `causal_uncertainty`
- `data_recency_risk`
- `human_review_required`
- `output_limit_exceeded`
- `materiality_uncertain`

Flags do not automatically invalidate a finding. They identify where review or additional work is required.

---

## 20. Human review

No final delivery may occur without human approval.

The reviewer must assess:

- decision framing;
- factual accuracy;
- source quality;
- analytical classification;
- materiality;
- causal logic;
- confidence;
- sensitive claims;
- PSN synthesis;
- options and trade-offs;
- recommendation values;
- unresolved flags.

Permitted reviewer actions:

- approve;
- revise;
- qualify;
- remove;
- reject;
- request additional research;
- change confidence;
- replace judgement.

---

## 21. Automated validation

The validator should test:

- mandatory core fields are present;
- output status is valid;
- each included finding has evidence;
- each included finding has decision effect;
- each included finding has judgement type and confidence;
- conditional fields are present when their trigger applies;
- power claims include mechanisms;
- systems findings include dependencies or implementation effects;
- narrative findings go beyond sentiment;
- PSN interaction exists unless evidence is insufficient;
- output limits are respected or justified;
- sensitive findings are flagged;
- analysis and recommendation are separate;
- human approval exists before delivery.

The validator checks procedure, not substantive truth.

---

## 22. Structured failure response

Example:

```json
{
  "agent": "narrative_analyst",
  "decision_id": "DEC-001",
  "analysis_depth": "standard",
  "output_status": "insufficient_evidence",
  "material_findings": [],
  "evidence_gaps": [
    "No reliable evidence links visible discourse to a material behavioural or institutional effect."
  ],
  "overall_confidence": "insufficient_evidence",
  "review_flags": ["evidence_gap"]
}
```

This is a valid and preferable result when evidence is weak.

---

## 23. Audit and software-generated metadata

The application, not the model, should generate where possible:

- timestamps;
- protocol version;
- doctrine version;
- agent version;
- schema-validation status;
- workflow state;
- source IDs already passed into the agent;
- audit-log identifiers.

The model should focus on analytical judgement.

---

## 24. Minimum viable implementation

The first build requires:

1. shared global rules;
2. analysis-depth control;
3. common agent-output schema;
4. decision-intake schema;
5. evidence-claim schema;
6. Power, Systems and Narrative finding schemas;
7. PSN interaction schema;
8. recommendation schema;
9. review flags;
10. structured failure responses;
11. human-review schema;
12. compliance validator.

---

## 25. Final runtime rule

> The doctrine defines what each agent must know how to examine. The runtime protocol defines what it must report for this decision.

The goal is not maximum output. The goal is a traceable chain from decision to evidence, judgement, PSN interaction, options and human-reviewed action.

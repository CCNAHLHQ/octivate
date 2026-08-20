# Octivate Developer Doctrine Brief v0.2
### Minimum analytical logic for building Octivate agents

**Status:** Internal working document  
**Source documents:** Octivate Analytical Doctrine v0.1.1 and Octivate Machine-Operational Protocol v0.2  
**Audience:** Jaden and future technical collaborators

---

## 1. What Octivate is

Octivate is a decision-intelligence system for organisations operating in or exposed to Caribbean contexts.

It is not primarily a country-profile generator. Every analysis must begin with a concrete decision.

The system should help answer:

1. Who can shape the outcome?
2. Through what mechanism?
3. Under what conditions?
4. What does this mean for the decision?

---

## 2. Core workflow

> Decision intake → evidence management → Power analysis → Systems analysis → Narrative analysis → PSN synthesis → scenarios and options → recommendation draft → human review → approved delivery

No final analysis should be delivered without human review.

---

## 3. The PSN model

### Power

Who can authorise, enable, block, delay or redefine the outcome?

A valid power finding identifies:

> actor → source of power → mechanism → target → condition → effect → constraint

### Systems

Through which institutions, infrastructures, markets and processes does the issue move?

A valid systems finding identifies:

- relevant system;
- operating condition;
- dependencies;
- chokepoints or implementation effects;
- decision effect.

### Narrative

How is the issue framed, legitimised, contested and translated into behaviour?

A valid narrative finding identifies:

- core claim;
- causal explanation;
- producers and carriers;
- target audience;
- implied action;
- decision effect.

Sentiment alone is not narrative analysis.

### PSN synthesis

The system must identify the one or two most consequential interactions among Power, Systems and Narrative.

---

## 4. The most important runtime principle

> **Agents inspect broadly but report narrowly.**

The doctrine defines everything an agent should know how to examine.

The runtime protocol defines what it should actually report for a particular decision.

An agent should not produce every possible field or category on every run.

It should return only findings that are:

- material to the decision;
- supported by sufficient evidence;
- necessary to explain the judgement, uncertainty, options or monitoring needs.

Agents must not generate weak content merely to complete a taxonomy or schema.

---

## 5. Materiality test

Before including a finding, the agent should ask:

> Could this finding change the decision, confidence, timing, option choice, exposure or monitoring requirement?

Include it when yes.

Exclude it when it is:

- background only;
- weakly related;
- duplicative;
- weakly evidenced;
- immaterial;
- included only for completeness.

Every included finding must state its decision effect.

---

## 6. Analysis depth

The orchestrator should assign:

### rapid

- up to 3 findings per lens;
- 1 PSN interaction;
- essential evidence only.

### standard

- up to 5 findings per lens;
- 1–2 PSN interactions;
- up to 3 scenarios;
- 2–4 options.

### deep_dive

- broader actor and systems analysis;
- more competing hypotheses;
- deeper scenarios and stress testing.

An agent may exceed the limit only when the additional item is material and the reason is recorded.

---

## 7. What every agent definition must contain

Each agent charter should contain:

### Identity

- agent name;
- agent version;
- doctrine version;
- protocol version.

### Purpose

One sentence explaining the agent’s role.

### Scope

What the agent must examine.

### Out of scope

What it must not attempt.

### Required inputs

The structured objects it must receive.

### Required output envelope

Every specialist agent should return:

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

### Mandatory finding fields

Every included finding must contain:

- finding ID;
- concise finding;
- decision effect;
- evidence IDs;
- judgement type;
- confidence;
- review flags.

### Conditional fields

The charter must state when fields become required.

Examples:

- competing explanations when credible alternatives exist;
- monitoring indicators when the issue is time-sensitive;
- informal pathways when formal and operating practice differ;
- failure transmission when disruption can cascade;
- counter-narratives when they materially affect the decision;
- normative trade-offs when recommendation values conflict.

### Optional fields

Only included when useful.

### Materiality rule

What qualifies for inclusion.

### Output limit

Default number of findings.

### Failure conditions

When to return:

- `partial`;
- `insufficient_evidence`;
- `not_applicable`;
- `invalid_input`;
- `further_research_required`.

### Escalation rules

When to return to research or route to human review.

### Acceptance tests

How the output will be validated.

### Example output

At least one worked example.

---

## 8. Core agents for the first prototype

### 8.1 Decision Intake Agent

Produces one decision object containing:

- decision question;
- owner;
- timeframe;
- geography;
- options;
- consequence of error;
- principal uncertainty;
- constraints;
- monitoring requirement.

Return `decision_scope_uncertain` where necessary.

### 8.2 Evidence Manager

Owns:

- source records;
- source reliability;
- evidence claims;
- source conflicts;
- evidence gaps;
- source IDs.

It should extract only evidence relevant to the decision or to a material analytical hypothesis.

### 8.3 Power Analyst

Inspects all power types but reports only the 3–5 most material findings in standard mode.

Each finding should contain:

- actor;
- power type;
- source of power;
- mechanism;
- target;
- condition;
- constraints;
- decision effect;
- evidence;
- confidence;
- flags.

### 8.4 Systems Analyst

Reports only the 2–4 systems findings that materially affect the decision.

It should focus on:

- operating practice;
- dependencies;
- chokepoints;
- implementation pathways;
- informal pathways where relevant;
- failure transmission;
- fracture indicators.

### 8.5 Narrative Analyst

Reports only 1–3 narratives that materially affect legitimacy, coordination or behaviour.

It must distinguish:

- belief;
- expression;
- visibility;
- behaviour.

It should not output a narrative merely because a topic is receiving attention.

### 8.6 PSN Synthesis Agent

Reports:

- 1 interaction in rapid mode;
- 1–2 in standard mode;
- up to 3 in deep-dive mode when justified.

Each interaction must explain how the Power, Systems and Narrative findings combine to change the decision.

### 8.7 Scenario and Recommendation Agent

Produces:

- scenarios;
- realistic options;
- trade-offs;
- preferred recommendation;
- monitoring indicators;
- reassessment triggers.

Analysis and recommendation must remain separate.

### 8.8 Human Review Assistant

Surfaces:

- unsupported findings;
- language exceeding evidence;
- source conflict;
- weak causal logic;
- immaterial findings;
- output-limit breaches;
- unresolved flags.

It cannot grant final approval.

---

## 9. Structured failure responses

A good agent is allowed to conclude that evidence is insufficient.

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

This is preferable to invented analysis.

---

## 10. Do not duplicate work

- Evidence Manager owns source records and extracted claims.
- Specialist agents reference evidence IDs.
- PSN Synthesis connects findings rather than repeating them.
- Recommendation Agent uses approved findings rather than rebuilding the evidence base.
- Application code should attach timestamps, versions and audit metadata.

---

## 11. Binding rules for all agents

1. Begin with a decision.
2. Link material findings to evidence.
3. Separate fact, inference, assumption, forecast and unknown.
4. Distinguish formal authority from effective power.
5. Distinguish official process from operating practice.
6. Distinguish visibility from representative opinion.
7. Do not infer intent as fact.
8. Do not treat relationships as proof of misconduct.
9. Report only material findings.
10. Assign confidence.
11. Apply flags.
12. Separate analysis from recommendation.
13. Identify a salient PSN interaction unless evidence is insufficient.
14. Block delivery until human approval.

---

## 12. First prototype acceptance criteria

The first working prototype should prove that:

1. A user request becomes a valid decision object.
2. Sources become traceable evidence claims.
3. Specialist agents return compact, schema-valid outputs.
4. Every included finding states its decision effect.
5. Every included finding links to evidence.
6. Weak or sensitive claims are flagged.
7. Agents can return insufficient-evidence responses.
8. The PSN agent identifies a consequential interaction.
9. Analysis and recommendation are separated.
10. Final delivery is blocked until human approval.

---

## 13. Suggested division of work

### Jaden

- workflow state machine;
- schema validation;
- orchestration;
- source and evidence IDs;
- audit trail;
- approval gate;
- model integration;
- prompts and charters;
- materiality rules;
- structured-output reliability;
- review flags;
- compliance tests;
- test cases and evaluation.

Jaden should also review the PSN Synthesis Agent.

---

## 14. Source-of-truth hierarchy

1. approved human-review decision;
2. Octivate Analytical Doctrine;
3. Machine-Operational Protocol;
4. Developer Doctrine Brief;
5. agent charter;
6. prompt wording;
7. model-generated interpretation.

---

## 15. Final development principle

The purpose of the agents is not to produce more text.

Their purpose is to create a traceable chain from:

> decision → evidence → material judgement → PSN interaction → options → human-reviewed action

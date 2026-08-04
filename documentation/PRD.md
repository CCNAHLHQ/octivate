# Product Requirements Document — Octivate

**Product:** Octivate (octivate.io)  
**Version:** MVP v0.2  
**Status:** Buildathon MVP  
**Stack:** Next.js 14 · Node TLS · Mock OpenRouter · File JSON store  

> Formerly referred to as “Octave.io” in early drafts. Canonical brand/domain: **Octivate / octivate.io**.

---

## Vision

Agentic decision intelligence for fragmented regional markets — Caribbean first. Transform a strategic question into a validated, evidence-backed decision brief with PSN analysis, confidence, gaps, and monitoring.

## MVP goals (in scope)

- User intelligence workspace (projects → question → 8-agent mock pipeline → brief)
- Operator console (API cost insight, limits, sessions, health)
- Mock external APIs (OpenRouter, trends, sources) with persistent local JSON
- Security: API key on mutations/operator, rate limits, security headers
- Production SSL path: Certbot via WSL2 + Cloudflare Full (strict)
- No login (deferred)

## Out of scope (Phase B)

- Supabase Auth / MFA
- Real OpenRouter billing
- Stripe / crypto payments
- Real virus scan / vector DB / knowledge graph
- Linux nginx / Docker

## Primary workflows

```
Landing → Workspace Overview
  → Create Project (country, sector)
  → Ask Strategic Question
  → Agent Workflow (8 stages + progress)
  → Decision Brief
  → Monitors / Sources / Stakeholders / Packs
```

Operator:

```
/operator → costs · limits · agent sessions · health
```

## Agents (mocked)

1. Decision Intake  
2. Planning  
3. Retrieval  
4. Validation  
5. Analysis (PSN)  
6. Decision  
7. Monitoring  
8. Learning  

## Evidence & confidence

Tiered sources (1–4), confidence 0–100%, explicit gaps, PSN (Power / Systems / Narratives).

## Roles (MVP)

| Role | Access |
|------|--------|
| Guest / Analyst (no login) | Full demo workspace via UI |
| Operator | `/operator` + operator APIs (API key) |

## Cost control

Operator sets `tokensPerDay`, `concurrentAgents`, upload caps. Usage and cost ledger visible on `/operator` and `/dashboard/usage`.

## Brand

Navy + teal dark UI; octopus/eight-agent metaphor; dense intelligence dashboard language inspired by ops platforms (not cloned).

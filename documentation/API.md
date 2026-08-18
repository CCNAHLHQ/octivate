# Octivate — API Reference (MVP)

Base URL: `https://octivate.io` (local dev: `http://localhost:4000`)

Auth header for mutations & operator routes:

```
Authorization: Bearer <OCTIVATE_API_KEY>
```

## Health

`GET /api/health` — liveness + OpenRouter mode (`mock` | `live`), key configured, default model

## Projects

- `GET /api/projects` — list
- `POST /api/projects` — `{ name, country, sector }`
- `GET /api/projects/:id`
- `POST /api/projects/:id/questions` — `{ question, analysisDepth? }` → starts pipeline (mock or doctrine), returns `{ session }`

## Agents

- `GET /api/agents/sessions`
- `GET /api/agents/sessions/:id`
- `GET /api/agents/sessions/:id/stream` — Server-Sent Events (`snapshot` / `update` / `done`)

**Pipeline modes:** `MOCK_OPENROUTER=true` (default) → fast demo; `false` + `OPENROUTER_API_KEY` → doctrine v0.2 agents with schema validation.

### OpenRouter model routing (dynamic)

Doctrine and docs models are resolved from the operator **model-config** store (ops DB key `model-config`), bootstrapped from env when empty, else falling back to recommended defaults:

| Role | Recommended default |
|------|---------------------|
| Doctrine default | `nvidia/nemotron-3.5-lightning:free` |
| Premium | `nvidia/nemotron-3-ultra-550b-a55b:free` |
| Fallback | `nvidia/nemotron-3.5-lightning:free` |
| Docs (summarize/extract) | `deepseek/deepseek-v4-flash` |

**Precedence:** persisted operator config -> `OPENROUTER_*` env bootstrap -> `RECOMMENDED_MODEL_CONFIG` in code. Allowlist merges curated IDs with the live OpenRouter catalog (`catalogModelIds()`). Operator UI: `/api/operator/model-config`. Claude/GPT/Gemini remain allowlisted for opt-in; speed-first defaults prefer Nemotron Lightning + DeepSeek Flash.

**Brief integrity:** doctrine agents validate against a common envelope plus agent-specific finding checks (one repair retry). Approve->Final runs `lib/briefs/release-validator.ts` hard blocks.

### OpenRouter model routing (dynamic)

Doctrine and docs models are resolved from the operator **model-config** store (ops DB key model-config), bootstrapped from env when empty, else falling back to recommended defaults:

| Role | Recommended default |
|------|---------------------|
| Doctrine default | 
vidia/nemotron-3.5-lightning:free |
| Premium | 
vidia/nemotron-3-ultra-550b-a55b:free |
| Fallback | 
vidia/nemotron-3.5-lightning:free |
| Docs (summarize/extract) | deepseek/deepseek-v4-flash |

**Precedence:** persisted operator config → OPENROUTER_* env bootstrap → RECOMMENDED_MODEL_CONFIG in code. Allowlist merges curated IDs with the live OpenRouter catalog (catalogModelIds()). Operator UI: /api/operator/model-config. Claude/GPT/Gemini remain allowlisted for opt-in; speed-first defaults prefer Nemotron Lightning + DeepSeek Flash.

**Brief integrity:** doctrine agents validate against a common envelope plus agent-specific finding checks (one repair retry). Approve→Final runs lib/briefs/release-validator.ts hard blocks.



## Briefs

- `GET /api/briefs`
- `GET /api/briefs/:id`
- `POST /api/briefs` — manual draft create
- `GET /api/briefs/:id/review` — brief + human review record
- `POST /api/briefs/:id/review` — operator: `{ action: "approve"|"reject"|"needs_revision", notes? }`

## Marquee

- `GET /api/marquee` — enabled items (public read)
- `GET /api/marquee?all=1` — all items (auth)
- `POST /api/marquee` — create ticker item
- `PATCH|DELETE /api/marquee/:id`

## Monitors / Sources / Stakeholders / Packs / Trends

- `GET|POST /api/monitors`
- `GET /api/sources`
- `GET /api/stakeholders`
- `GET /api/packs`
- `GET /api/trends`

## Usage

- `GET /api/usage` — tokens + estimated USD

## Operator

All require API key:

- `GET|PATCH /api/operator/limits`
- `GET /api/operator/costs`
- `GET /api/operator/reviews` — pending brief review queue
- `GET /api/operator/compliance?sessionId=` — doctrine compliance checks
- `GET|DELETE /api/operator/moderation`

### Limits body (PATCH)

```json
{
  "tokensPerDay": 250000,
  "concurrentAgents": 3,
  "maxUploadsPerProject": 20,
  "maxFileSizeMb": 25,
  "allowPremiumModels": false,
  "requireHumanReview": true
}
```

## Errors

| Status | Meaning |
|--------|---------|
| 400 | Validation |
| 401 | Missing/invalid API key |
| 404 | Not found |
| 429 | Rate limit or operator concurrent/token cap |
| 500 | Server error |

## Mock vs live

| Env | Behaviour |
|-----|-----------|
| `MOCK_OPENROUTER=true` (default) | Demo pipeline, instant final briefs |
| `MOCK_OPENROUTER=false` + `OPENROUTER_API_KEY` | Live OpenRouter, doctrine agents, `pending_review` briefs |

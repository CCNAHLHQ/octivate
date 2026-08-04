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

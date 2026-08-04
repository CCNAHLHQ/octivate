# Implementation Roadmap

## Phase 0 — Cleanup
- [x] Remove win-acme + local certs
- [x] Archive HTML prototypes
- [x] Tighten gitignore; brand → octivate.io

## Phase 1 — Mock API spine + security
- [x] JSON file store + seed data
- [x] Mock OpenRouter + 8-agent orchestrator + SSE
- [x] Projects, briefs, monitors, sources, stakeholders, packs, trends, usage, operator APIs
- [x] API key gate, rate limits, middleware headers

## Phase 2 — Workspace + operator UI
- [x] Remodeled shell (teal/navy, Lucide)
- [x] Overview widgets (gauge, donut, risk bars, tables)
- [x] Linked routes including ask-question + brief detail
- [x] Operator command center

## Phase 3 — Production TLS
- [x] `server/prod.mjs` HTTPS terminator
- [x] Certbot WSL2 + sync script docs
- [ ] Issue live cert on VPS (ops step)
- [ ] Cloudflare Full (strict) cutover (ops step)

## Phase 4 — Docs
- [x] PRD, API, SECURITY, DEPLOYMENT, SSL_CERTBOT

## Phase B (partial)
- [x] Live OpenRouter client + MOCK_OPENROUTER toggle
- [x] Doctrine v0.2 pipeline (8 agents, schema validation)
- [x] Human review gate + operator approval
- [x] Support page with team credits
- [ ] Supabase Auth
- [ ] Payments
- [ ] Vector / KG persistence

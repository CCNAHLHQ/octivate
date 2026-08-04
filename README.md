# Octivate

Agentic decision intelligence for the Caribbean — **octivate.io**

## Quick start

```bash
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
npm run dev
```

- Landing: http://localhost:4000  
- Workspace: http://localhost:4000/dashboard  
- Operator: http://localhost:4000/operator  
- Support: http://localhost:4000/support  

Default API key: `octivate-dev-key`

## Mock vs live pipeline

| Mode | Env | Behaviour |
|------|-----|-----------|
| **Mock** (default) | `MOCK_OPENROUTER=true` | Fast demo pipeline, instant final briefs |
| **Live** | `MOCK_OPENROUTER=false` + `OPENROUTER_API_KEY` | Doctrine v0.2 agents, schema validation, operator review gate |

Protocol spec: [`protocol/v0.2/`](protocol/v0.2/)

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js development |
| `npm run build` | Production build |
| `npm start` | Next on :3000 |
| `npm run pack:deploy` | Zip source for upload (no node_modules / secrets) |
| `npm run serve:prod` | Edge: auto-SSL + HTTP/HTTPS → Next |
| `npm run certs:selfsigned` | Force-regenerate self-signed PEMs → `certs/` |
| `npm run certs:sync` | Sync WSL Certbot (Let’s Encrypt) PEMs → `certs/` |
| `npm run certs:check` | Verify PEMs exist + not expired |

TLS keys stay on the host ([SSL docs](documentation/SSL_CERTBOT.md)). Default: both `:80` and `:443` serve the app.

## Documentation

- [PRD](documentation/PRD.md)
- [API](documentation/API.md)
- [Security](documentation/SECURITY.md)
- [Deployment](documentation/DEPLOYMENT.md)
- [SSL / Certbot](documentation/SSL_CERTBOT.md)
- [Roadmap](documentation/ROADMAP.md)

## Stack

Next.js 16 · Tailwind · Framer Motion · Recharts · Zod · Lucide · OpenRouter (mock/live) · Protocol v0.2 · JSON file store

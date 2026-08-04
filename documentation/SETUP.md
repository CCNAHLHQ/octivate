# Setup

## Local development

```powershell
npm install
copy .env.example .env.local
# Edit keys if desired (default octivate-dev-key works)
npm run dev
```

Open http://localhost:3000

## Environment

See `.env.example`:

- `OCTIVATE_API_KEY` / `NEXT_PUBLIC_OCTIVATE_API_KEY`
- `NEXT_PUBLIC_APP_URL`
- `MOCK_OPENROUTER=true`
- SSL paths for production only

## Production (Windows Server 2019)

1. [SSL_CERTBOT.md](./SSL_CERTBOT.md)
2. [DEPLOYMENT.md](./DEPLOYMENT.md)

## Project structure

```
app/           Next.js routes + API
components/    UI + dashboard + landing
lib/           store, agents, security, mock, openrouter
server/        prod.mjs TLS terminator
scripts/       cert sync
documentation/ PRD, API, security, deploy
data/local/    runtime JSON (gitignored contents)
```

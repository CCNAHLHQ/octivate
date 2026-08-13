# Octivate — Deployment (Windows Server 2019)

## Target

| Item | Value |
|------|-------|
| Domain | https://octivate.io |
| Origin IP | 184.174.96.119 |
| Edge | Cloudflare |
| App | Next.js 14 standalone / `next start` |
| TLS | Certbot (WSL2) → Node HTTPS terminator |

## Live deploy pipeline (this origin host)

On the Windows origin, ship UI/code changes with one command:

```powershell
npm run deploy:live
# alias: npm run ship
```

What it does:

1. `npm run build`
2. Restarts Next (`127.0.0.1:$NEXT_PORT`) + `server/prod.mjs` edge (80/443)
3. Health-checks local Next and `https://octivate.io/api/health`
4. Commits **safe** workspace changes (never `.env`, PEMs, `data/local/`, etc.)
5. `git push` to `origin` (uses `OCTIVATE_GIT_TOKEN` / `GITHUB_TOKEN` / `GH_TOKEN` when set)

Useful flags:

```powershell
npm run deploy:live -- --message "Ship checkout polish"
npm run deploy:live -- --skip-git          # build + restart only
npm run deploy:live -- --skip-restart      # build + commit/push only
npm run deploy:live -- --skip-build        # restart + git only
npm run deploy:live -- --dry-run
```

Agents / operators: prefer `npm run deploy:live` instead of hand-rolling build → kill ports → restart → commit → push.

## Zip → upload → build (recommended)

On your workstation:

```powershell
npm run pack:deploy
# → dist/octivate-deploy-YYYYMMDD-HHmm.zip
```

The zip **excludes** `node_modules`, `.next`, `.env*`, and `*.pem` (secrets stay off the wire). Upload + extract on the server, then:

```powershell
cd C:\path\to\octatve
copy .env.example .env   # set OCTIVATE_API_KEY (+ APP_URL if needed)
npm ci
npm run build

# Terminal A — Next (loopback only)
npx next start -H 127.0.0.1 -p 3000

# Terminal B — edge (auto SSL into certs/, HTTP :80 + HTTPS :443)
npm run serve:prod
```

Cloudflare: **Full** with self-signed origin; **Full (strict)** after Let’s Encrypt.

## Build

```powershell
cd C:\path\to\octatve
copy .env.example .env   # then edit secrets
npm ci
npm run build
```

## Process model

1. **Next.js** listens on `127.0.0.1:3000` only (`next start -H 127.0.0.1 -p 3000`)
2. **`server/prod.mjs`** serves **HTTP `:80` and HTTPS `:443`**, both proxying to Next (set `FORCE_HTTPS=true` to redirect HTTP → HTTPS)

```powershell
npx next start -H 127.0.0.1 -p 3000
npm run serve:prod
```

Use NSSM, WinSW, or Task Scheduler to keep both processes alive and restart after cert sync.

## Firewall

- Allow inbound TCP **80** and **443** from Cloudflare IP ranges (or world if using Cloudflare proxy)
- Do **not** expose `:3000` publicly

## Health check

`GET https://octivate.io/api/health` → `{ "status": "ok" }`

## Secrets checklist

- [ ] `OCTIVATE_API_KEY` rotated from `octivate-dev-key`
- [ ] Cloudflare API token only on WSL (`chmod 600`)
- [ ] PEMs only under repo `certs/` (gitignored `*.pem`)
- [ ] `.env` not committed

## Rollback

Keep previous `.next` build folder; stop TLS proxy; restore prior standalone; re-sync certs if needed.

See also: [SSL_CERTBOT.md](./SSL_CERTBOT.md), [SECURITY.md](./SECURITY.md), [PAYMENTS.md](./PAYMENTS.md)

# Octivate — Security

## Threat model (MVP)

Octivate MVP runs **without user login**. Protection focuses on:

1. Abuse of mutating APIs and operator controls
2. Probe / scanner noise
3. Accidental secret leakage
4. Origin TLS integrity behind Cloudflare

## API authentication

- Header: `Authorization: Bearer <OCTIVATE_API_KEY>`
- Required for: all `POST`/`PATCH`/`DELETE` **except** public opt-in routes, and **all** `/api/operator/*`
- Public exception: `POST /api/mailing-list` (subscribe / unsubscribe) — no API key; stricter rate limit (8/min/IP); zod + honeypot
- Public GETs for workspace demo data are allowed but **rate-limited**
- Dev default key: `octivate-dev-key` (override via `.env`)
- Browser demo uses `NEXT_PUBLIC_OCTIVATE_API_KEY` — **rotate before production** and prefer server-only key once auth ships

## Rate limiting

In-memory buckets (per IP + route class):

| Class | Limit | Window |
|-------|-------|--------|
| Public GET | 120 | 60s |
| Mutate / operator | 40 | 60s |
| Public mutation (mailing list) | 8 | 60s |
| SSE | 30 | 60s |

Returns `429 Too Many Requests` with `X-RateLimit-*` headers.

## Middleware headers

Applied in [`middleware.ts`](../middleware.ts):

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera/mic/geo disabled)
- CSP (default-src self; connect-src self)
- HSTS in production / HTTPS
- `X-Request-Id`
- Blocks common probe paths (`.env`, `wp-admin`, `.git`, etc.)

## TLS & secrets

- Never commit PEMs, keys, or Cloudflare API tokens
- Certs live under repo `certs/<domain>/` (gitignored `*.pem`) — `npm run certs:selfsigned` or Certbot sync
- Edge serves **HTTP and HTTPS** by default; HSTS is set on HTTPS responses only
- Cloudflare: **Full** with self-signed origin; **Full (strict)** after Let’s Encrypt
- Operator limits enforce token/day and concurrent agent caps

## Input validation

All mutating bodies validated with **zod** schemas in `lib/validation/schemas.ts`.

## Future (Phase B)

- Supabase Auth / session cookies
- Per-user API keys
- Redis rate limits
- Upload virus scan + MIME allowlist enforcement at storage layer

# Octivate — TLS (self-signed bring-up + Certbot upgrade)

## Traffic model

`npm run serve:prod` listens on **both**:

| Port | Protocol | Behavior (default) |
|------|----------|--------------------|
| `HTTP_PORT` (80) | HTTP | Proxies to Next.js — open |
| `PORT` (443) | HTTPS | Proxies to Next.js with TLS |

Set `FORCE_HTTPS=true` only if you want `:80` to 301 → HTTPS.

## Path A — Self-signed (fastest on a new host)

Certbot issues **public CA** certificates; it does **not** create self-signed certs. For origin bring-up:

```powershell
# Next on :3000, then one command — SSL auto-created if missing:
npm run serve:prod
```

`serve:prod` writes `certs/octivate.io/*.pem` on first boot, then opens **HTTP + HTTPS**. Browsers warn on self-signed until Let’s Encrypt. Cloudflare **Full** works with self-signed origin certs.

## Path B — Certbot / Let’s Encrypt (production)

Native Certbot for Windows was discontinued. Use **Certbot inside WSL2 (Ubuntu)** with the **Cloudflare DNS-01** plugin, then sync PEMs to Windows for Node.

## Important: certs are not in the source upload

| Travels with source (git / zip / deploy) | Generated on the server into `certs/` |
|----------------------------------------|----------------------------------------|
| `certs/` folder + README | `certs/octivate.io/fullchain.pem` |
| `server/prod.mjs`, `certs:selfsigned` | `certs/octivate.io/privkey.pem` |
| Relative paths in `.env.example` | Let’s Encrypt live dir (WSL) until synced |

Private keys are **gitignored** (`*.pem`). After you copy source onto the VPS:

1. `npm run certs:selfsigned` **or** Certbot + `npm run certs:sync`  
2. `npm run certs:check`  
3. `npm run serve:prod` → HTTP **and** HTTPS  

If PEMs are missing, `serve:prod` exits with a clear error.

## Prerequisites

- Domain **octivate.io** DNS in Cloudflare
- A record → `184.174.96.119` (proxied after origin HTTPS works; can be DNS-only during first bring-up)
  - Update via `npm run dns:origin` when `CLOUDFLARE_API_TOKEN` + `SERVER_PUBLIC_IP` are set in `.env`
- Cloudflare API token with **Zone → DNS → Edit** for `octivate.io` only
- WSL2 + Ubuntu on Windows Server 2019
- Ports 80/443 free for the Node TLS terminator (`npm run serve:prod`)

## 1. Install WSL2 Ubuntu

```powershell
wsl --install -d Ubuntu
# reboot if prompted, then create Linux user
```

## 2. Install Certbot + Cloudflare plugin (in Ubuntu)

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-dns-cloudflare
```

## 3. Cloudflare credentials

```bash
sudo mkdir -p /etc/letsencrypt
sudo tee /etc/letsencrypt/cloudflare.ini >/dev/null <<'EOF'
dns_cloudflare_api_token = YOUR_TOKEN_HERE
EOF
sudo chmod 600 /etc/letsencrypt/cloudflare.ini
```

## 4. Issue certificate

```bash
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d octivate.io \
  -d www.octivate.io \
  --agree-tos \
  -m you@octivate.io \
  --non-interactive
```

Certs land in `/etc/letsencrypt/live/octivate.io/`.

## 5. Sync to Windows

From elevated PowerShell in the repo:

```powershell
npm run certs:sync
# or:
powershell -ExecutionPolicy Bypass -File scripts/sync-certs.ps1
```

Expected files (repo-relative):

- `certs/octivate.io/fullchain.pem`
- `certs/octivate.io/privkey.pem`

## 6. Environment

```env
SSL_CERT_PATH=certs/octivate.io/fullchain.pem
SSL_KEY_PATH=certs/octivate.io/privkey.pem
NEXT_PUBLIC_APP_URL=https://octivate.io
PORT=443
HTTP_PORT=80
NEXT_PORT=3000
FORCE_HTTPS=false
```

## 7. Run stack

```powershell
npm run build
# terminal A
npx next start -p 3000
# terminal B (admin for :443/:80)
npm run serve:prod
```

## 8. Cloudflare

1. SSL/TLS → **Full (strict)**
2. Orange-cloud A/AAAA for `@` and `www`
3. Optional: Always Use HTTPS, HSTS

## 9. Renewal

```bash
# cron inside WSL (example)
sudo crontab -e
# 0 3 * * * certbot renew --quiet && /mnt/c/path/to/repo/scripts/renew-hook.sh
```

After renew, run `scripts/sync-certs.ps1` and restart the Node TLS process (Task Scheduler recommended).

## Removed

- Root `cert.crt` / `cert.key` / `cert.pfx` (local `octivate.local`)
- Bundled **win-acme** — do not reintroduce

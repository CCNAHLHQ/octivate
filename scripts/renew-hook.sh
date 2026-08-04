#!/usr/bin/env bash
# Called after `certbot renew` inside WSL.
# Syncs PEMs to Windows and optionally restarts the TLS process.
set -euo pipefail

REPO_WIN="${OCTIVATE_REPO_WIN:-/mnt/c/Users/User/Desktop/octatve}"
DOMAIN="${OCTIVATE_DOMAIN:-octivate.io}"

echo "[renew-hook] Syncing $DOMAIN certs to Windows…"
powershell.exe -ExecutionPolicy Bypass -File "$(wslpath -w "$REPO_WIN")/scripts/sync-certs.ps1" -Domain "$DOMAIN"

echo "[renew-hook] Done. Restart Node TLS terminator if it does not reload PEMs automatically:"
echo "  npm run serve:prod"

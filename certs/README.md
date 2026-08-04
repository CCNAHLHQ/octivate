# TLS certificates (server)

This folder holds PEMs used by `npm run serve:prod` on the **host**.

```
certs/
  octivate.io/
    fullchain.pem   # public chain
    privkey.pem     # private key (never commit)
    meta.json       # self-signed metadata (optional)
```

## Serve = SSL on immediately

```bash
npm run serve:prod
```

On start, the edge **auto-creates** self-signed PEMs in this folder if they are missing or expired, then binds **HTTP + HTTPS**. No separate cert step required.

Optional:

```bash
npm run certs:selfsigned   # force regenerate
npm run certs:check        # verify
```

Paths are **relative to the repo** (`certs/<domain>/…`). `.pem` files are gitignored.

Upgrade to Let’s Encrypt later: Certbot + `npm run certs:sync` (same folder). Set `SSL_AUTO=false` to disable auto-generate.

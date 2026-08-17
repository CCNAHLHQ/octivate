# Permanent i18n catalogs

Locale JSON files under `locales/` are the durable OpenRouter-synced translations
served by `/api/i18n/catalog`. Keep this directory in git — do **not** store catalogs
under `data/local/` (gitignored).

Rebuild / fill gaps:

```bash
node --env-file=.env scripts/i18n-sync.mjs
node --env-file=.env scripts/i18n-sync.mjs es fr
```

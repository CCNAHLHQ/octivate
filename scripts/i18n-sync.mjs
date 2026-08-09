/**
 * CLI: prebuild permanent i18n catalogs via OpenRouter.
 * Usage: node --env-file=.env scripts/i18n-sync.mjs [locale ...]
 */
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const jiti = require("jiti")(fileURLToPath(import.meta.url), {
  interopDefault: true,
  alias: { "@": ROOT },
});

const { syncI18nCatalogs } = jiti(path.join(ROOT, "lib/i18n/sync.ts"));

const locales = process.argv.slice(2).filter(Boolean);
console.log("[i18n-sync] starting", locales.length ? locales.join(",") : "all");
const result = await syncI18nCatalogs(locales.length ? { locales } : undefined);
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);

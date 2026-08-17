import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const jiti = require("jiti")(fileURLToPath(import.meta.url), {
  interopDefault: true,
  alias: { "@": ROOT },
});
const { getEnglishSource } = jiti(path.join(ROOT, "lib/i18n/messages.ts"));
const { hashSource } = jiti(path.join(ROOT, "lib/i18n/hash.ts"));
const { loadDynamicEnglish } = jiti(path.join(ROOT, "lib/i18n/dynamic.ts"));

const en = { ...getEnglishSource(), ...(await loadDynamicEnglish()) };
const locales = process.argv.slice(2);
const localesDir = path.join(ROOT, "data/i18n/locales");
const targets = locales.length
  ? locales
  : fs.readdirSync(localesDir).map((f) => f.replace(/\.json$/, ""));

for (const locale of targets) {
  const file = path.join(localesDir, `${locale}.json`);
  if (!fs.existsSync(file)) continue;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const missing = [];
  for (const [key, source] of Object.entries(en)) {
    const e = data.entries?.[key];
    if (!e?.text || e.sourceHash !== hashSource(source)) missing.push(key);
  }
  console.log(`\n## ${locale} missing ${missing.length}`);
  for (const k of missing.slice(0, 40)) console.log(k);
  if (missing.length > 40) console.log(`… +${missing.length - 40} more`);
}

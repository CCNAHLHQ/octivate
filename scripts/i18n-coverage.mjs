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

const en = getEnglishSource();
const enKeys = Object.keys(en);
const localesDir = path.join(ROOT, "data/i18n/locales");

for (const f of fs.readdirSync(localesDir).filter((x) => x.endsWith(".json"))) {
  const data = JSON.parse(fs.readFileSync(path.join(localesDir, f), "utf8"));
  const entries = data.entries || {};
  let fresh = 0;
  let stale = 0;
  let missing = 0;
  for (const key of enKeys) {
    const e = entries[key];
    if (!e?.text) {
      missing++;
      continue;
    }
    const h = hashSource(en[key]);
    if (e.sourceHash === h) fresh++;
    else stale++;
  }
  const pct = (((fresh / enKeys.length) * 100) || 0).toFixed(1);
  console.log(
    `${f.replace(".json", "")}: ${fresh}/${enKeys.length} fresh (${pct}%) missing=${missing} stale=${stale} fileEntries=${Object.keys(entries).length}`
  );
}
console.log("EN source keys", enKeys.length);

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENTRIES = path.join(ROOT, "lib", "future-caribbean", "entries.json");
const GH =
  "https://github.com/CCNAHLHQ/octivate/blob/main/docs/future-caribbean-logbook/screenshots";

const raw = JSON.parse(fs.readFileSync(ENTRIES, "utf8"));
let n = 0;
for (const w of raw.weeks) {
  for (const d of w.days) {
    const screenshot = `${GH}/${d.key.replace(/\s+/g, "_").replace(/\//g, "_")}.png`;
    d.screenshot = screenshot;
    d.body = (d.body || "").replace(
      /Evidence screenshot:\s*https?:\/\/\S+/g,
      `Evidence screenshot: ${screenshot}`
    );
    if (!d.body.includes("Evidence screenshot:")) {
      d.body += `\n\nEvidence screenshot: ${screenshot}`;
    }
    n += 1;
  }
}
fs.writeFileSync(ENTRIES, JSON.stringify(raw, null, 2));
console.log(JSON.stringify({ updated: n, sample: raw.weeks.at(-1)?.days?.at(-1)?.screenshot }));

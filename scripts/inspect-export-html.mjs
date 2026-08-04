import fs from "fs";
const h = JSON.parse(fs.readFileSync("data/local/export-templates.json", "utf8"))[0].htmlBody;
const classes = [...h.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));
const counts = {};
for (const c of classes) counts[c] = (counts[c] || 0) + 1;
console.log(
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([k, v]) => `${k}:${v}`)
    .join("\n")
);
const bodyStart = h.search(/<body[^>]*>/i);
console.log("\n--- BODY HEAD ---\n");
console.log(h.slice(bodyStart, bodyStart + 3500));
const i = h.indexOf("02 · PSN");
console.log("\n--- PSN ---\n");
console.log(h.slice(i, i + 2000));
const j = h.indexOf("04 · Confidence");
console.log("\n--- CONF ---\n");
console.log(h.slice(j, j + 1800));

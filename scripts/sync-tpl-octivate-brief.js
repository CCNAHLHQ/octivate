const fs = require("fs");
const path = require("path");

const root = process.cwd();
const htmlPath = path.join(root, "data/local/export-assets/tpl_octivate_brief/tokenized-brief.html");
const cssPath = path.join(root, "data/local/export-assets/tpl_octivate_brief/design-styles.css");
const storePaths = [
  path.join(root, "data/local/export-templates.json"),
  path.join(root, ".next/standalone/data/local/export-templates.json"),
];

const htmlBody = fs.readFileSync(htmlPath, "utf8");
const styleMatch = htmlBody.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) {
  console.error("No <style> block in tokenized-brief.html");
  process.exit(1);
}
const css = styleMatch[1].trim() + "\n";
fs.writeFileSync(cssPath, css, "utf8");
console.log("Updated design-styles.css", css.length, "bytes");

function findTemplate(store) {
  if (store && store.id === "tpl_octivate_brief") return store;
  if (Array.isArray(store)) return store.find((t) => t && t.id === "tpl_octivate_brief");
  if (store && typeof store === "object") {
    for (const v of Object.values(store)) {
      if (v && typeof v === "object" && v.id === "tpl_octivate_brief") return v;
    }
  }
  return null;
}

const previewText = "Decision Intelligence Brief — canvas/paper tokens, PSN counts, branded footer";

for (const storePath of storePaths) {
  if (!fs.existsSync(storePath)) {
    console.log("Skip missing", storePath);
    continue;
  }
  const raw = fs.readFileSync(storePath, "utf8");
  const store = JSON.parse(raw);
  const tpl = findTemplate(store);
  if (!tpl) {
    console.error("tpl_octivate_brief not found in", storePath);
    process.exit(1);
  }
  tpl.htmlBody = htmlBody;
  if (!tpl.previewText || tpl.previewText.includes("premade")) {
    tpl.previewText = previewText;
  }
  tpl.updatedAt = new Date().toISOString();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2) + "\n", "utf8");
  const body = tpl.htmlBody;
  const ok = ["--canvas", "is-zero", "psn-count", "fbrand"].every((k) => body.includes(k));
  console.log("Synced", storePath, "markersOK", ok, "htmlLen", body.length);
}

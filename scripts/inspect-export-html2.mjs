import fs from "fs";
const h = JSON.parse(fs.readFileSync("data/local/export-templates.json", "utf8"))[0].htmlBody;
// strip base64 for readability of structure
const clean = h.replace(/data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+/g, "data:image/png;base64,[ASSET]");
const bodyStart = clean.search(/<body[^>]*>/i);
const body = clean.slice(bodyStart);
// mast through description
const d = body.indexOf("01 · Description");
console.log(body.slice(0, d + 1200));
console.log("\n---GAPS---\n");
const g = body.indexOf("06 · Evidence");
console.log(body.slice(g, g + 1200));
console.log("\n---MON---\n");
const m = body.indexOf("07 · Monitoring");
console.log(body.slice(m, m + 1200));
console.log("\n---GAUGE CSS---\n");
const style = (h.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || "";
const gi = style.indexOf(".gauge");
console.log(style.slice(gi, gi + 800));
const si = style.indexOf(".strip");
console.log("\n---STRIP---\n", style.slice(si, si + 500));

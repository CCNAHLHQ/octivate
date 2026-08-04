import fs from "fs";
const h = JSON.parse(fs.readFileSync("data/local/export-templates.json", "utf8"))[0].htmlBody;
const st = (h.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || "";
for (const k of [".pri", ".now", ".q3", ".med", ".hot", ".warn", ".ok", ".fill", "badge.high", "badge.med"]) {
  const i = st.indexOf(k);
  console.log(k, i >= 0 ? st.slice(i, i + 140).replace(/\s+/g, " ") : "MISSING");
}
console.log("mustache", (h.match(/\{\{/g) || []).length);
console.log("guyana count", (h.match(/Guyana/g) || []).length);

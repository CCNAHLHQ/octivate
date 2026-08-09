import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "lib/i18n/registry");
let total = 0;
for (const f of fs.readdirSync(root).filter((x) => x.endsWith(".ts"))) {
  const s = fs.readFileSync(path.join(root, f), "utf8");
  const c = (s.match(/^\s*"[^"]+":/gm) || []).length;
  total += c;
  console.log(f, c);
}
console.log("total", total);

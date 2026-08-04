const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const src = process.argv[2];
if (!src) {
  console.error("Usage: node read-docx.js <file.docx>");
  process.exit(1);
}

const tmp = path.join(process.env.TEMP || ".", "phase1-docx-extract");
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

const zipPath = path.join(tmp, "doc.zip");
fs.copyFileSync(src, zipPath);

execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-Command",
    `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${tmp.replace(/'/g, "''")}' -Force`,
  ],
  { stdio: "pipe" }
);

const xml = fs.readFileSync(path.join(tmp, "word", "document.xml"), "utf8");
const texts = [];
const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
let m;
while ((m = re.exec(xml))) texts.push(m[1]);

// Rebuild roughly by paragraphs
const paras = xml.split(/<\/w:p>/).map((chunk) => {
  const parts = [];
  const r = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let mm;
  while ((mm = r.exec(chunk))) parts.push(mm[1]);
  return parts.join("");
});

console.log(paras.join("\n"));

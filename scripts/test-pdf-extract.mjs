/**
 * Smoke-test PDF text extraction (pdf-parse v2 PDFParse API).
 * Run: npm run test:pdf-extract
 */
import assert from "node:assert/strict";
import { extractBinaryDocument } from "../lib/evidence/extract.ts";

/** Minimal one-page PDF with a Helvetica text layer. */
function buildFixturePdf(marker) {
  const stream = `BT /F1 24 Tf 72 720 Td (${marker}) Tj ET`;
  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n",
    `4 0 obj<< /Length ${Buffer.byteLength(stream, "utf8")} >>stream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += obj;
  }
  const xrefStart = Buffer.byteLength(body, "utf8");
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += xref;
  body += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body, "utf8");
}

async function main() {
  const marker = "OctivateInsuranceExtractProbe2026";
  const pdf = buildFixturePdf(marker);
  const result = await extractBinaryDocument(pdf, ".pdf", 8_000);
  assert.ok(result, "extractBinaryDocument returned null for PDF");
  assert.equal(result.mode, "pdf", `expected mode pdf, got ${result.mode}: ${result.text.slice(0, 120)}`);
  assert.ok(
    result.text.includes(marker),
    `extracted text missing marker. got: ${result.text.slice(0, 200)}`
  );

  const emptyish = await extractBinaryDocument(Buffer.from("%PDF-1.4\n%%EOF\n"), ".pdf");
  assert.ok(emptyish);
  assert.equal(emptyish.mode, "binary_meta", "corrupt/empty PDF should be binary_meta, not throw");

  console.log("pdf-extract: ok");
  console.log(`  chars=${result.text.length} mode=${result.mode}`);
}

main().catch((err) => {
  console.error("pdf-extract: FAIL", err);
  process.exit(1);
});

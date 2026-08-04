import mammoth from "mammoth";
import { sanitizePlainText } from "@/lib/docs/sanitize-text";

export type ExtractResult = {
  text: string;
  mode: "text" | "pdf" | "docx" | "binary_meta";
};

async function extractPdf(bytes: Buffer, maxChars: number): Promise<ExtractResult> {
  // pdf-parse is CJS; dynamic import keeps Next bundling happier.
  const mod = await import("pdf-parse");
  const pdfParse = (mod as { default?: (b: Buffer) => Promise<{ text: string }> }).default || mod;
  const parsed = await (pdfParse as (b: Buffer) => Promise<{ text: string }>)(bytes);
  const text = sanitizePlainText(parsed.text || "", maxChars);
  if (!text.trim()) {
    return {
      text: sanitizePlainText(
        "PDF contained no extractable text layer. Image-only OCR is not enabled for this file yet."
      ),
      mode: "binary_meta",
    };
  }
  return { text, mode: "pdf" };
}

async function extractDocx(bytes: Buffer, maxChars: number): Promise<ExtractResult> {
  const result = await mammoth.extractRawText({ buffer: bytes });
  const text = sanitizePlainText(result.value || "", maxChars);
  if (!text.trim()) {
    return {
      text: sanitizePlainText("DOCX contained no extractable text."),
      mode: "binary_meta",
    };
  }
  return { text, mode: "docx" };
}

/** Extract text from PDF/DOCX bytes (text-layer). Image OCR is a later channel. */
export async function extractBinaryDocument(
  bytes: Buffer,
  ext: string,
  maxChars = 12_000
): Promise<ExtractResult | null> {
  const e = ext.toLowerCase();
  try {
    if (e === ".pdf") return await extractPdf(bytes, maxChars);
    if (e === ".docx" || e === ".doc") {
      if (e === ".doc") {
        return {
          text: sanitizePlainText(
            "Legacy .doc format is not supported for extract; convert to .docx or PDF."
          ),
          mode: "binary_meta",
        };
      }
      return await extractDocx(bytes, maxChars);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      text: sanitizePlainText(`Extract failed: ${message.slice(0, 200)}`),
      mode: "binary_meta",
    };
  }
  return null;
}

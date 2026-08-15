import mammoth from "mammoth";
import { sanitizePlainText } from "@/lib/docs/sanitize-text";

export type ExtractResult = {
  text: string;
  mode: "text" | "pdf" | "docx" | "binary_meta";
};

/** Align with map-reduce summarizer ceiling so evidence + summarize share one extract. */
export const DEFAULT_EXTRACT_MAX_CHARS = 80_000;

type PdfParseModule = {
  PDFParse: new (opts: { data: Uint8Array }) => {
    getText: () => Promise<{ text?: string }>;
    destroy: () => Promise<void>;
  };
};

async function loadPdfParse(): Promise<PdfParseModule> {
  const mod = (await import("pdf-parse")) as PdfParseModule & {
    default?: PdfParseModule;
  };
  if (typeof mod.PDFParse === "function") return mod;
  if (mod.default && typeof mod.default.PDFParse === "function") return mod.default;
  throw new Error(
    "pdf-parse v2 PDFParse class is unavailable. Reinstall pdf-parse@^2.4 or pin a compatible build."
  );
}

async function extractPdf(bytes: Buffer, maxChars: number): Promise<ExtractResult> {
  // pdf-parse@2 exports { PDFParse } — not a callable default (v1 API).
  const { PDFParse } = await loadPdfParse();
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    const text = sanitizePlainText(result?.text || "", maxChars);
    if (!text.trim()) {
      return {
        text: sanitizePlainText(
          "PDF contained no extractable text layer. Image-only / scanned PDFs need OCR (not enabled for this file yet). Re-upload a text PDF or provide a text/CSV export."
        ),
        mode: "binary_meta",
      };
    }
    return { text, mode: "pdf" };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
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

function operatorFacingExtractError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  // Legacy v1-style call against v2 surfaces minified "X is not a function".
  if (lower.includes("is not a function")) {
    return "PDF text extraction failed (incompatible pdf-parse API). Operator: redeploy with pdf-parse v2 PDFParse.getText() path.";
  }
  if (lower.includes("password") || lower.includes("encrypted")) {
    return "PDF is password-protected or encrypted; upload an unlocked copy.";
  }
  if (lower.includes("invalid pdf") || lower.includes("pdf format")) {
    return "File is not a valid PDF or is corrupted; re-export and upload again.";
  }
  return `PDF/DOCX extract failed: ${raw.slice(0, 180)}`;
}

/** Extract text from PDF/DOCX bytes (text-layer). Image OCR is a later channel. */
export async function extractBinaryDocument(
  bytes: Buffer,
  ext: string,
  maxChars = DEFAULT_EXTRACT_MAX_CHARS
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
    return {
      text: sanitizePlainText(operatorFacingExtractError(err)),
      mode: "binary_meta",
    };
  }
  return null;
}

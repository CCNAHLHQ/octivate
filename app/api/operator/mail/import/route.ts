import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { assertAllowedOrigin } from "@/lib/security/origin";
import { requireOperatorUser, resolveRequestUser } from "@/lib/auth/scope";
import {
  importMailingSubscribers,
  parseMailingImportText,
} from "@/lib/mail/import-mailing-list";

const MAX_BYTES = 2_000_000;
const ALLOWED_EXT = [".csv", ".tsv", ".txt", ".json", ".text"];

function allowedFile(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_EXT.some((ext) => lower.endsWith(ext));
}

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const originDenied = assertAllowedOrigin(req);
  if (originDenied) return originDenied;

  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Expected multipart form data");
  }

  const files = form
    .getAll("files")
    .concat(form.getAll("file"))
    .filter((f): f is File => typeof File !== "undefined" && f instanceof File);

  if (!files.length) return jsonError("No files uploaded");

  const allRows = [];
  const fileReports: {
    name: string;
    rows: number;
    error?: string;
  }[] = [];

  for (const file of files) {
    if (!allowedFile(file.name)) {
      fileReports.push({
        name: file.name,
        rows: 0,
        error: "Unsupported format (use CSV, TSV, TXT, or JSON)",
      });
      continue;
    }
    if (file.size > MAX_BYTES) {
      fileReports.push({
        name: file.name,
        rows: 0,
        error: "File too large (max 2 MB)",
      });
      continue;
    }
    try {
      const text = await file.text();
      const rows = parseMailingImportText(text, file.name);
      allRows.push(...rows);
      fileReports.push({ name: file.name, rows: rows.length });
    } catch (err) {
      fileReports.push({
        name: file.name,
        rows: 0,
        error: err instanceof Error ? err.message : "Parse failed",
      });
    }
  }

  if (!allRows.length) {
    return jsonError(
      fileReports.find((f) => f.error)?.error ||
        "No valid email addresses found in the upload"
    );
  }

  const result = await importMailingSubscribers(allRows);
  return jsonOk({
    ok: true,
    ...result,
    files: fileReports.map((f) => f.name),
    fileReports,
    message: `Imported ${result.added} new · ${result.updated} updated · ${result.total} active`,
  });
}

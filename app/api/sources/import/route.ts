import { NextRequest } from "next/server";
import { guardApi, jsonOk, jsonError } from "@/lib/security/guard";
import { runSourcesImportRequest } from "@/lib/sources/import-http";

/**
 * POST /api/sources/import
 * Multipart: one or more CSV files (`file` / `files`) — merge by default.
 * Auth: Bearer API key or operator key (same as other workspace mutations).
 */
export async function POST(req: NextRequest) {
  // operator:true → requireOperatorKey (accepts OCTIVATE_API_KEY or OPERATOR_KEY)
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;

  try {
    const result = await runSourcesImportRequest(req);
    if (!result.ok) return jsonError(result.error, result.status);
    return jsonOk(result.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return jsonError(message, 400);
  }
}

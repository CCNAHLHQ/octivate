import { NextRequest } from "next/server";
import { guardApi, jsonOk, jsonError } from "@/lib/security/guard";
import { runSourcesImportRequest } from "@/lib/sources/import-http";

/**
 * POST /api/operator/sources/import
 * Same multi-CSV import as /api/sources/import (operator-guarded).
 */
export async function POST(req: NextRequest) {
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

import { NextRequest } from "next/server";
import { guardApi, jsonError } from "@/lib/security/guard";

/**
 * Seed rehydrate is retired — the live registry is upload/CSV only.
 * Kept as a stub so old clients get a clear error instead of silently restoring mocks.
 */
export async function POST(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  return jsonError(
    "Seed sources are disabled. Upload a CSV or add sources manually.",
    410
  );
}

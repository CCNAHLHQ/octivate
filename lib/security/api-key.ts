import { NextRequest, NextResponse } from "next/server";

const DEV_FALLBACK_KEY = "octivate-dev-key";

export function getExpectedApiKey(): string {
  return process.env.OCTIVATE_API_KEY || DEV_FALLBACK_KEY;
}

/** Prefer dedicated operator key when set; otherwise fall back to API key (no lockout). */
export function getExpectedOperatorKey(): string {
  return process.env.OCTIVATE_OPERATOR_KEY || getExpectedApiKey();
}

export function extractBearer(req: Request | NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

/** Mutating methods require a valid API key. */
export function requireApiKey(req: Request | NextRequest): NextResponse | null {
  const key = extractBearer(req);
  if (!key || key !== getExpectedApiKey()) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Valid Bearer API key required" },
      { status: 401 }
    );
  }
  return null;
}

/** Operator routes: accept OCTIVATE_OPERATOR_KEY or OCTIVATE_API_KEY. */
export function requireOperatorKey(req: Request | NextRequest): NextResponse | null {
  const key = extractBearer(req);
  const expected = getExpectedOperatorKey();
  const apiKey = getExpectedApiKey();
  if (!key || (key !== expected && key !== apiKey)) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Valid operator Bearer key required" },
      { status: 401 }
    );
  }
  return null;
}

export function isMutating(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export function clientIp(req: Request | NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

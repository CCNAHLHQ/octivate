import { NextRequest, NextResponse } from "next/server";

/** Soft origin check for public mutating routes — allows same-origin and configured app URL. */
export function assertAllowedOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  if (!origin) return null; // non-browser / same-origin navigations

  const app = process.env.NEXT_PUBLIC_APP_URL || "";
  const host = req.headers.get("host") || "";
  const allowed = new Set<string>();
  if (app) {
    try {
      allowed.add(new URL(app).origin);
    } catch {
      /* ignore */
    }
  }
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }
  allowed.add("http://127.0.0.1:4000");
  allowed.add("http://localhost:4000");
  allowed.add("http://127.0.0.1");
  allowed.add("http://localhost");

  if (allowed.has(origin)) return null;
  return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
}

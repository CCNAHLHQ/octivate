import { NextRequest } from "next/server";
import { guardApi, jsonOk } from "@/lib/security/guard";
import { revokeSessionToken } from "@/lib/auth/sessions";
import {
  readBearerOrCookie,
  SESSION_COOKIE,
  SESSION_EXP_COOKIE,
  sessionCookieSecure,
} from "@/lib/auth/scope";

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { publicMutation: true });
  if (denied) return denied;

  const token = readBearerOrCookie(req);
  if (token) await revokeSessionToken(token);

  const res = jsonOk({ ok: true, signedOut: true });
  // Clear both secure and insecure variants so HTTP/HTTPS cookie mismatch cannot sticky-session.
  for (const secure of [true, false] as const) {
    const clear = {
      httpOnly: true as const,
      sameSite: "lax" as const,
      secure,
      path: "/",
      maxAge: 0,
    };
    res.cookies.set(SESSION_COOKIE, "", clear);
    res.cookies.set(SESSION_EXP_COOKIE, "", { ...clear, httpOnly: false });
  }
  void sessionCookieSecure();
  return res;
}

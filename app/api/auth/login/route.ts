import { NextRequest, NextResponse } from "next/server";
import { guardApi, jsonError } from "@/lib/security/guard";
import { clientIp } from "@/lib/security/api-key";
import { authenticateUser, toPublicUser } from "@/lib/auth/users";
import { createSession } from "@/lib/auth/sessions";
import {
  SESSION_COOKIE,
  SESSION_EXP_COOKIE,
  SESSION_MAX_AGE_SEC,
  sessionCookieSecure,
} from "@/lib/auth/scope";
import { loginAllowed } from "@/lib/auth/lockout";

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { publicMutation: true });
  if (denied) return denied;

  let body: { username?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const identity = String(body.username || body.email || "").trim();
  const password = String(body.password || "");
  if (!identity || !password) {
    return jsonError("Email/username and password required");
  }

  const ip = clientIp(req);
  const lock = loginAllowed(ip, identity);
  if (!lock.allowed) {
    return NextResponse.json(
      {
        error: "Too many sign-in attempts. Try again later.",
        code: "rate_limited",
        retryAfterSec: lock.retryAfterSec,
      },
      {
        status: 429,
        headers: { "Retry-After": String(lock.retryAfterSec) },
      }
    );
  }

  const user = await authenticateUser(identity, password);
  if (!user) {
    return jsonError("Invalid credentials", 401);
  }
  if (user.disabled) {
    return jsonError("This account has been disabled. Contact support.", 403);
  }

  const { token, session } = await createSession(user.id);
  const res = NextResponse.json({
    user: toPublicUser(user),
    token,
    session: { expiresAt: session.expiresAt, createdAt: session.createdAt },
    message: "Signed in successfully",
  });
  const secure = sessionCookieSecure();
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
  res.cookies.set(SESSION_EXP_COOKIE, session.expiresAt, {
    httpOnly: false,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
  return res;
}

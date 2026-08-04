import { consumePasswordResetToken } from "@/lib/auth/password-reset";
import { setUserPasswordDirect, toPublicUser } from "@/lib/auth/users";
import { createSession } from "@/lib/auth/sessions";
import {
  SESSION_COOKIE,
  SESSION_EXP_COOKIE,
  SESSION_MAX_AGE_SEC,
  sessionCookieSecure,
} from "@/lib/auth/scope";
import { NextResponse } from "next/server";
import { emitOpsEvent } from "@/lib/ops/event-log";
import { guardApi, jsonError } from "@/lib/security/guard";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { publicMutation: true });
  if (denied) return denied;

  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const token = String(body.token || "").trim();
  const password = String(body.password || "");
  if (!token) return jsonError("Reset token required");
  if (password.length < 10) {
    return jsonError("Password must be at least 10 characters");
  }

  const record = await consumePasswordResetToken(token);
  if (!record) {
    return jsonError("This reset link is invalid or has expired", 400);
  }

  try {
    const updated = await setUserPasswordDirect(record.userId, password);
    if (!updated) return jsonError("Account not found", 404);

    const { token: sessionToken, session } = await createSession(updated.id);
    const res = NextResponse.json({
      ok: true,
      user: toPublicUser(updated),
      message: "Password updated. You are signed in.",
    });
    const secure = sessionCookieSecure();
    res.cookies.set(SESSION_COOKIE, sessionToken, {
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

    void emitOpsEvent({
      level: "info",
      source: "security",
      message: "password_reset_completed",
      meta: { userId: updated.id },
    });

    return res;
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Reset failed", 400);
  }
}

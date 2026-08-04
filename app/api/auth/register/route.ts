import { NextRequest, NextResponse } from "next/server";
import { guardApi, jsonError } from "@/lib/security/guard";
import { clientIp } from "@/lib/security/api-key";
import { provisionUser } from "@/lib/auth/users";
import { createSession } from "@/lib/auth/sessions";
import {
  SESSION_COOKIE,
  SESSION_EXP_COOKIE,
  SESSION_MAX_AGE_SEC,
  sessionCookieSecure,
} from "@/lib/auth/scope";
import { registerAllowed } from "@/lib/auth/lockout";
import { generatePassword, generateUsername } from "@/lib/auth/crypto";
import { getOperatorLimits } from "@/lib/auth/profile-limits";

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { publicMutation: true });
  if (denied) return denied;

  const ip = clientIp(req);
  const lock = registerAllowed(ip);
  if (!lock.allowed) {
    return NextResponse.json(
      {
        error: "Too many registrations from this network. Try again later.",
        code: "rate_limited",
        retryAfterSec: lock.retryAfterSec,
      },
      {
        status: 429,
        headers: { "Retry-After": String(lock.retryAfterSec) },
      }
    );
  }

  let body: {
    acceptTerms?: boolean;
    acceptPrivacy?: boolean;
    /** When true, only preview generated credentials without creating the account. */
    preview?: boolean;
    /** One-click provision when operator allows autogenerate (skips terms UI). */
    autogenerate?: boolean;
    username?: string;
    password?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  if (body.preview) {
    const username = generateUsername("oct");
    const password = generatePassword();
    return NextResponse.json({
      credentials: {
        username,
        password,
        email: `${username}@members.octivate.io`,
      },
    });
  }

  const limits = await getOperatorLimits();
  const autogenAllowed = limits.allowAutogenerateAccounts !== false;
  const usingAutogen = Boolean(body.autogenerate) && autogenAllowed;

  if (!usingAutogen && (!body.acceptTerms || !body.acceptPrivacy)) {
    return jsonError("You must accept the Terms and Privacy Policy");
  }
  if (body.autogenerate && !autogenAllowed) {
    return jsonError("Autogenerate signup is disabled by the operator", 403);
  }

  const username = String(body.username || "").trim() || generateUsername("oct");
  const password = String(body.password || "") || generatePassword();

  try {
    const { user, password: issued } = await provisionUser({
      role: "member",
      username,
      password,
      email: `${username}@members.octivate.io`,
      displayName: username,
    });

    const { token, session } = await createSession(user.id);
    const res = NextResponse.json({
      user,
      credentials: {
        username: user.username,
        password: issued,
        email: user.email,
      },
      session: { expiresAt: session.expiresAt, createdAt: session.createdAt },
      message: "Account created. Save your credentials — the password is shown once.",
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Registration failed";
    return jsonError(msg, 409);
  }
}

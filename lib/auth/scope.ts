import type { NextRequest } from "next/server";
import { resolveSessionToken } from "@/lib/auth/sessions";
import { findUserById, toPublicUser } from "@/lib/auth/users";
import type { PublicUser } from "@/lib/auth/types";
import type { Project } from "@/lib/types";

const SESSION_COOKIE = "octivate_session";
/** Non-httpOnly companion so Edge middleware can expire stale sessions without hashing. */
const SESSION_EXP_COOKIE = "octivate_session_exp";

export const SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60;

export function sessionCookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

/** True when Authorization is the platform API/operator key, not a user session. */
export function isApiKeyBearer(token: string): boolean {
  const t = token.trim();
  if (!t) return true;
  if (t.startsWith("octivate")) return true;
  if (t.length < 24) return true;
  const expected =
    process.env.OCTIVATE_API_KEY ||
    process.env.NEXT_PUBLIC_OCTIVATE_API_KEY ||
    "octivate-dev-key";
  const operator = process.env.OCTIVATE_OPERATOR_KEY || "";
  return t === expected || (Boolean(operator) && t === operator);
}

/**
 * Prefer a real session bearer; otherwise fall back to the httpOnly session cookie.
 * Critical: `apiFetch` always sends the API key as Bearer — that must not mask the cookie.
 */
export function readBearerOrCookie(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token && !isApiKeyBearer(token)) return token;
  }
  return req.cookies.get(SESSION_COOKIE)?.value || null;
}

export async function resolveRequestUser(req: NextRequest): Promise<PublicUser | null> {
  const token = readBearerOrCookie(req);
  if (!token) return null;
  const session = await resolveSessionToken(token);
  if (!session) return null;
  const user = await findUserById(session.userId);
  if (!user || user.disabled) return null;
  return toPublicUser(user);
}

export async function resolveRequestSession(req: NextRequest) {
  const token = readBearerOrCookie(req);
  if (!token) return null;
  return resolveSessionToken(token);
}

/**
 * Filter projects so members only see their own; operators see all.
 * Unauthenticated browser sessions get an empty list (secure default).
 * Ops tooling that authenticates via session-less API key still sees all
 * when the caller never established a user — prefer attaching a session.
 */
export function filterProjectsForUser(projects: Project[], user: PublicUser | null): Project[] {
  if (!user) return [];
  if (user.role === "operator") return projects;
  return projects.filter((p) => p.ownerId === user.id);
}

export function assertProjectAccess(
  project: Project,
  user: PublicUser | null
): { ok: true } | { ok: false; status: number; error: string } {
  if (!user) return { ok: false, status: 401, error: "Authentication required" };
  if (user.role === "operator") return { ok: true };
  if (project.ownerId === user.id) return { ok: true };
  return { ok: false, status: 404, error: "Project not found" };
}

export function requireSessionUser(
  user: PublicUser | null
): { ok: true; user: PublicUser } | { ok: false; status: number; error: string } {
  if (!user) return { ok: false, status: 401, error: "Authentication required" };
  return { ok: true, user };
}

export function requireOperatorUser(
  user: PublicUser | null
): { ok: true; user: PublicUser } | { ok: false; status: number; error: string } {
  if (!user) return { ok: false, status: 401, error: "Authentication required" };
  if (user.role !== "operator") {
    return { ok: false, status: 403, error: "Operator access required" };
  }
  return { ok: true, user };
}

export { SESSION_COOKIE, SESSION_EXP_COOKIE };

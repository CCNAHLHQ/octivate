import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { provisionUser } from "@/lib/auth/users";
import type { UserRole } from "@/lib/auth/types";

/**
 * Operator-only: autogenerate username/password.
 * Plaintext password is returned once — store it securely; never logged.
 */
export async function POST(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;

  let role: UserRole = "member";
  let username: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.role === "operator" || body?.role === "member") role = body.role;
    if (typeof body?.username === "string") username = body.username;
  } catch {
    /* defaults */
  }

  try {
    const result = await provisionUser({ role, username });
    return jsonOk(
      {
        user: result.user,
        password: result.password,
        notice: "Copy the password now. It is not stored in plaintext and will not be shown again.",
      },
      { status: 201 }
    );
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Provision failed", 500);
  }
}

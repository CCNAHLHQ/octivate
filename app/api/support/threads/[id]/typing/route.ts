import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { assertAllowedOrigin } from "@/lib/security/origin";
import { requireSessionUser, resolveRequestUser } from "@/lib/auth/scope";
import { getSupportThread, setSupportTyping } from "@/lib/support/store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req, { support: true });
  if (denied) return denied;
  const originDenied = assertAllowedOrigin(req);
  if (originDenied) return originDenied;

  const user = await resolveRequestUser(req);
  const gate = requireSessionUser(user);
  if (!gate.ok) return jsonError("Sign in required", gate.status);

  const { id } = await params;
  const thread = await getSupportThread(id);
  if (!thread) return jsonError("Not found", 404);

  const isOperator = gate.user.role === "operator";
  if (!isOperator && thread.userId !== gate.user.id) {
    return jsonError("Unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }
  const raw = (body || {}) as Record<string, unknown>;
  const active = Boolean(raw.active ?? raw.typing ?? true);
  const role = isOperator ? "operator" : "user";
  const name = isOperator
    ? gate.user.displayName || gate.user.username || "Support"
    : gate.user.displayName || gate.user.username || gate.user.email;

  const typing = setSupportTyping({
    threadId: id,
    role,
    name,
    active,
  });

  return jsonOk({ typing });
}

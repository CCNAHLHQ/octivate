import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { assertAllowedOrigin } from "@/lib/security/origin";
import { requireSessionUser, resolveRequestUser } from "@/lib/auth/scope";
import {
  appendSupportMessage,
  getSupportThread,
  publicThread,
} from "@/lib/support/store";
import {
  clientIpFromHeaders,
  parseUserAgent,
} from "@/lib/support/client-meta";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req);
  if (denied) return denied;
  const { id } = await params;
  const thread = await getSupportThread(id);
  if (!thread) return jsonError("Not found", 404);

  const user = await resolveRequestUser(req);
  const gate = requireSessionUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);
  if (thread.userId !== gate.user.id && gate.user.role !== "operator") {
    return jsonError("Unauthorized", 401);
  }
  return jsonOk({ thread: publicThread(thread) });
}

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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }
  const raw = (body || {}) as Record<string, unknown>;
  const ua = String(raw.userAgent || req.headers.get("user-agent") || "");
  const parsed = parseUserAgent(ua);

  try {
    const thread = await appendSupportMessage({
      threadId: id,
      role: "user",
      body: String(raw.body || raw.message || ""),
      userId: gate.user.id,
      attachments: raw.attachments,
      clientMeta: {
        ip: clientIpFromHeaders(req.headers),
        userAgent: ua,
        browser: parsed.browser,
        os: parsed.os,
        language: String(raw.language || "").slice(0, 32) || undefined,
      },
    });
    return jsonOk({ thread: publicThread(thread) });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Send failed", 400);
  }
}

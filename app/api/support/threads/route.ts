import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { assertAllowedOrigin } from "@/lib/security/origin";
import { requireSessionUser, resolveRequestUser } from "@/lib/auth/scope";
import {
  createSupportThread,
  listSupportThreads,
  publicThread,
} from "@/lib/support/store";
import {
  clientIpFromHeaders,
  parseUserAgent,
} from "@/lib/support/client-meta";

export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireSessionUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);
  const all = await listSupportThreads();
  const mine = all.filter((t) => t.userId === gate.user.id).map(publicThread);
  return jsonOk({ threads: mine });
}

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { support: true });
  if (denied) return denied;
  const originDenied = assertAllowedOrigin(req);
  if (originDenied) return originDenied;

  const user = await resolveRequestUser(req);
  const gate = requireSessionUser(user);
  if (!gate.ok) return jsonError("Sign in required to contact support", gate.status);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }
  const raw = (body || {}) as Record<string, unknown>;
  if (raw.website) return jsonOk({ ok: true });

  const ua = String(raw.userAgent || req.headers.get("user-agent") || "");
  const parsed = parseUserAgent(ua);
  const language = String(
    raw.language || req.headers.get("accept-language") || ""
  ).split(",")[0]?.trim();

  try {
    const thread = await createSupportThread({
      userId: gate.user.id,
      email: gate.user.email,
      displayName: gate.user.displayName,
      username: gate.user.username,
      avatarUrl: gate.user.avatarUrl,
      subject: String(raw.subject || "Help request"),
      body: String(raw.body || raw.message || ""),
      attachments: raw.attachments,
      clientMeta: {
        ip: clientIpFromHeaders(req.headers),
        userAgent: ua,
        browser: parsed.browser,
        os: parsed.os,
        language,
      },
    });
    return jsonOk({ thread: publicThread(thread) });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Could not create thread", 400);
  }
}

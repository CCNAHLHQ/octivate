import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { assertAllowedOrigin } from "@/lib/security/origin";
import { readCollection, writeCollection, uid } from "@/lib/store/json-store";
import { mailingListSchema } from "@/lib/validation/schemas";
import type { MailingSubscriber } from "@/lib/types";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { publicMutation: true });
  if (denied) return denied;
  const originDenied = assertAllowedOrigin(req);
  if (originDenied) return originDenied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const parsed = mailingListSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Invalid input");
  }

  // Honeypot trip — pretend success, store nothing
  if (parsed.data.website) {
    return jsonOk({ ok: true });
  }

  const email = normalizeEmail(parsed.data.email);
  const action = parsed.data.action;
  const now = new Date().toISOString();
  const list = await readCollection<MailingSubscriber>("mailing-list", []);

  if (action === "unsubscribe") {
    const existing = list.find((s) => s.email === email);
    if (!existing) {
      return jsonOk({ ok: true, status: "unsubscribed" });
    }
    existing.status = "unsubscribed";
    existing.unsubscribedAt = now;
    existing.updatedAt = now;
    await writeCollection("mailing-list", list);
    return jsonOk({ ok: true, status: "unsubscribed" });
  }

  if (parsed.data.consent !== true) {
    return jsonError("Consent is required to join the mailing list");
  }

  const existing = list.find((s) => s.email === email);
  if (existing) {
    existing.status = "active";
    existing.name = parsed.data.name?.trim() || existing.name;
    existing.consentedAt = now;
    existing.unsubscribedAt = undefined;
    existing.updatedAt = now;
    await writeCollection("mailing-list", list);
    return jsonOk({ ok: true, status: "active", resumed: true });
  }

  const entry: MailingSubscriber = {
    id: uid("mail"),
    email,
    name: parsed.data.name?.trim() || undefined,
    source: "landing",
    status: "active",
    consentedAt: now,
    updatedAt: now,
  };
  list.push(entry);
  await writeCollection("mailing-list", list);
  return jsonOk({ ok: true, status: "active" }, { status: 201 });
}

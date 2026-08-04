import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import {
  allowedFromAddresses,
  clearMailbox,
  deleteMailboxMessage,
  listInbox,
  sendMail,
} from "@/lib/mail/store";
import {
  DEFAULT_MAIL_TEMPLATE_ID,
  DEFAULT_MAIL_TEMPLATE_NAME,
} from "@/lib/mail/default-template";
import { requireOperatorUser, resolveRequestUser } from "@/lib/auth/scope";
import { assertAllowedOrigin } from "@/lib/security/origin";
import { readCollection } from "@/lib/store/json-store";
import type { MailingSubscriber } from "@/lib/types";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  const preferredFrom = gate.user.email;
  const fromOptions = allowedFromAddresses(preferredFrom);
  // Prefer signed-in account first in the picker.
  const orderedFrom = [
    preferredFrom,
    ...fromOptions.filter((e) => e.toLowerCase() !== preferredFrom.toLowerCase()),
  ];

  const mailbox =
    req.nextUrl.searchParams.get("mailbox") || preferredFrom || "";
  const messages = await listInbox(mailbox);
  const mailing = await readCollection<MailingSubscriber>("mailing-list", []);
  const activeMailing = mailing.filter((m) => m.status !== "unsubscribed");

  return jsonOk({
    mailbox,
    messages,
    fromOptions: orderedFrom,
    preferredFrom,
    mailing: activeMailing,
    mailingTotal: mailing.length,
    defaultTemplate: {
      id: DEFAULT_MAIL_TEMPLATE_ID,
      name: DEFAULT_MAIL_TEMPLATE_NAME,
    },
  });
}

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  let body: {
    action?: "send" | "bulk";
    from?: string;
    to?: string[];
    subject?: string;
    text?: string;
    html?: string;
    useDefaultTemplate?: boolean;
    selectAllMailing?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const from = String(
    body.from || gate.user.email || process.env.MAIL_FROM || "no-reply@octivate.io"
  );
  const subject = String(body.subject || "").trim();
  const text = String(body.text || "").trim();
  if (!subject || !text) return jsonError("Subject and body are required");

  let to = Array.isArray(body.to) ? body.to.map(String) : [];
  if (body.action === "bulk" || body.selectAllMailing) {
    const subs = await readCollection<MailingSubscriber>("mailing-list", []);
    const active = subs.filter((s) => s.status !== "unsubscribed").map((s) => s.email);
    to = body.selectAllMailing ? active : to.filter((e) => active.includes(e));
  }
  if (!to.length) return jsonError("No recipients selected");

  try {
    const result = await sendMail({
      from,
      to,
      subject,
      text,
      html: body.html ? String(body.html) : undefined,
      useDefaultTemplate: body.useDefaultTemplate !== false,
      bulk: body.action === "bulk" || Boolean(body.selectAllMailing),
      operatorEmail: gate.user.email,
    });

    const hasErrors = result.errors.length > 0;
    return jsonOk({
      ...result,
      recipients: to.length,
      message: hasErrors ? "Failed" : "Sent",
      ok: !hasErrors,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Send failed", 400);
  }
}

export async function DELETE(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const originDenied = assertAllowedOrigin(req);
  if (originDenied) return originDenied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  let body: { mailbox?: string; id?: string; clearAll?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* query-only deletes allowed */
  }

  const mailbox = String(
    body.mailbox ||
      req.nextUrl.searchParams.get("mailbox") ||
      gate.user.email ||
      ""
  )
    .trim()
    .toLowerCase();
  if (!mailbox) return jsonError("Mailbox required");

  const allowed = allowedFromAddresses(gate.user.email).map((e) => e.toLowerCase());
  if (!allowed.includes(mailbox) && mailbox !== gate.user.email.toLowerCase()) {
    return jsonError("Mailbox not permitted", 403);
  }

  try {
    const clearAll =
      body.clearAll === true ||
      req.nextUrl.searchParams.get("clearAll") === "1";
    const id = String(body.id || req.nextUrl.searchParams.get("id") || "").trim();

    if (clearAll) {
      const result = await clearMailbox(mailbox);
      const messages = await listInbox(mailbox);
      return jsonOk({
        ok: true,
        mailbox,
        cleared: result.cleared,
        messages,
        message:
          result.cleared > 0
            ? `Cleared ${result.cleared} message${result.cleared === 1 ? "" : "s"} from inbox`
            : "Inbox was already empty",
        warnings: result.cleared === 0 ? ["No messages to clear"] : [],
        errors: [],
      });
    }

    if (!id) return jsonError("Message id required (or set clearAll)");
    const result = await deleteMailboxMessage(mailbox, id);
    const messages = await listInbox(mailbox);
    if (!result.removed) {
      return jsonOk({
        ok: false,
        mailbox,
        removed: false,
        messages,
        message: "Message not found in this mailbox",
        warnings: ["That message was already removed or never existed here"],
        errors: [],
      });
    }
    return jsonOk({
      ok: true,
      mailbox,
      removed: true,
      remaining: result.remaining,
      messages,
      message: "Message cleared from inbox",
      warnings: [],
      errors: [],
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Clear failed", 400);
  }
}

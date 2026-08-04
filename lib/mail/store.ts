import { promises as fs } from "fs";
import path from "path";
import { createTransport, type SentMessageInfo } from "nodemailer";
import { uid } from "@/lib/store/json-store";
import { STAFF_PROFILES } from "@/lib/support/staff";
import { emitOpsEvent } from "@/lib/ops/event-log";
import {
  DEFAULT_MAIL_LOGO_CID,
  DEFAULT_MAIL_TEMPLATE_ID,
  DEFAULT_MAIL_TEMPLATE_NAME,
  renderDefaultMailHtml,
} from "@/lib/mail/default-template";
import {
  defaultInviteCopy,
  loadMailPricingCards,
  type MailIntent,
} from "@/lib/mail/invite-defaults";
import {
  loadMailIconAttachments,
  loadMailLogoAttachment,
  mailLogoPublicUrl,
  type MailInlineAttachment,
} from "@/lib/mail/logo-attach";
import { ensureLocalSmtp, smtpUnavailableHint } from "@/lib/mail/ensure-smtp";

const MAIL_DIR = path.join(process.cwd(), "data", "local", "mailboxes");
const OUTBOX_FILE = path.join(process.cwd(), "data", "local", "mail-outbox.json");

export type MailMessage = {
  id: string;
  mailbox: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  at: string;
  direction: "inbound" | "outbound";
  bulk?: boolean;
  templateId?: string;
};

export type MailSendDiagnostics = {
  delivered: "smtp" | "local";
  id: string;
  accepted: string[];
  rejected: string[];
  response?: string;
  messageId?: string;
  warnings: string[];
  errors: string[];
  templateId: string;
  templateName: string;
};

function mailFrom(): string {
  return process.env.MAIL_FROM || "no-reply@octivate.io";
}

function smtpTransport() {
  const host = process.env.HARAKA_HOST || "127.0.0.1";
  const port = Number(process.env.HARAKA_PORT || 2525);
  return createTransport({
    host,
    port,
    secure: false,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 4000,
    greetingTimeout: 4000,
    logger: false,
  });
}

async function ensureMailDir() {
  await fs.mkdir(MAIL_DIR, { recursive: true });
}

function mailboxPath(address: string) {
  const safe = address.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
  return path.join(MAIL_DIR, `${safe}.json`);
}

async function readMailbox(address: string): Promise<MailMessage[]> {
  await ensureMailDir();
  try {
    const raw = await fs.readFile(mailboxPath(address), "utf8");
    return JSON.parse(raw) as MailMessage[];
  } catch {
    return [];
  }
}

async function writeMailbox(address: string, messages: MailMessage[]) {
  await ensureMailDir();
  await fs.writeFile(mailboxPath(address), JSON.stringify(messages, null, 2), "utf8");
}

async function appendOutbox(msg: MailMessage) {
  await ensureMailDir();
  let rows: MailMessage[] = [];
  try {
    rows = JSON.parse(await fs.readFile(OUTBOX_FILE, "utf8")) as MailMessage[];
  } catch {
    rows = [];
  }
  rows.unshift(msg);
  await fs.writeFile(OUTBOX_FILE, JSON.stringify(rows.slice(0, 2000), null, 2), "utf8");
}

export function allowedFromAddresses(operatorEmail?: string): string[] {
  const list = [mailFrom(), ...STAFF_PROFILES.map((s) => s.email)];
  if (operatorEmail && !list.includes(operatorEmail)) list.push(operatorEmail);
  return Array.from(new Set(list));
}

export async function listInbox(mailbox: string): Promise<MailMessage[]> {
  const messages = await readMailbox(mailbox);
  return messages.sort((a, b) => b.at.localeCompare(a.at));
}

export async function deleteMailboxMessage(
  mailbox: string,
  messageId: string
): Promise<{ removed: boolean; remaining: number }> {
  const address = mailbox.trim().toLowerCase();
  if (!address) throw new Error("Mailbox required");
  const id = String(messageId || "").trim();
  if (!id) throw new Error("Message id required");

  const rows = await readMailbox(address);
  const next = rows.filter((m) => m.id !== id);
  if (next.length === rows.length) {
    return { removed: false, remaining: rows.length };
  }
  await writeMailbox(address, next);
  return { removed: true, remaining: next.length };
}

export async function clearMailbox(
  mailbox: string
): Promise<{ cleared: number }> {
  const address = mailbox.trim().toLowerCase();
  if (!address) throw new Error("Mailbox required");
  const rows = await readMailbox(address);
  if (!rows.length) return { cleared: 0 };
  await writeMailbox(address, []);
  return { cleared: rows.length };
}

function asStringList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return [String(value)].filter(Boolean);
}

function smtpCodeHint(response?: string): "ok" | "warn" | "error" {
  if (!response) return "ok";
  const code = Number(String(response).trim().slice(0, 3));
  if (!Number.isFinite(code)) return "ok";
  if (code >= 500) return "error";
  if (code >= 400) return "warn";
  return "ok";
}

export async function sendMail(input: {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  bulk?: boolean;
  useDefaultTemplate?: boolean;
  /** Signed-in operator email — allowed as From. */
  operatorEmail?: string;
  preheader?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  secondaryUrl?: string;
  secondaryLabel?: string;
  siteUrl?: string;
  eyebrow?: string;
  greetingName?: string;
  bullets?: string[];
  expiryNote?: string;
  recipientNote?: string;
  signOff?: string;
  signOffRole?: string;
  /** Defaults to invite for branded operator sends. */
  intent?: MailIntent;
}): Promise<MailSendDiagnostics> {
  const from = input.from.trim().toLowerCase();
  const to = input.to.map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!to.length) throw new Error("At least one recipient is required");
  const allowed = allowedFromAddresses(input.operatorEmail);
  if (!allowed.includes(from)) {
    throw new Error("From address is not permitted");
  }

  const intent: MailIntent = input.intent || "invite";
  const invite = defaultInviteCopy(input.greetingName);
  const subject = (input.subject || (intent === "invite" ? invite.subject : "")).slice(
    0,
    200
  );
  const text = (input.text || (intent === "invite" ? invite.text : "")).slice(0, 20000);
  if (!subject || !text) throw new Error("Subject and body are required");

  const useDefaultTemplate = input.useDefaultTemplate !== false;
  const siteUrl = (
    input.siteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://octivate.io"
  ).replace(/\/$/, "");

  const inlineAttachments: MailInlineAttachment[] = [];
  let logoAttachment: MailInlineAttachment | null = null;
  if (useDefaultTemplate && !input.html?.trim()) {
    logoAttachment = await loadMailLogoAttachment();
    if (logoAttachment) inlineAttachments.push(logoAttachment);
    if (intent === "invite") {
      inlineAttachments.push(...(await loadMailIconAttachments()));
    }
  }

  const pricingCards =
    useDefaultTemplate && !input.html?.trim() && intent === "invite"
      ? await loadMailPricingCards()
      : [];

  const html =
    input.html?.trim() ||
    (useDefaultTemplate
      ? renderDefaultMailHtml({
          subject,
          text,
          from,
          intent,
          preheader: input.preheader || (intent === "invite" ? invite.preheader : undefined),
          ctaUrl:
            input.ctaUrl ||
            (intent === "invite" ? `${siteUrl}${invite.ctaPath}` : undefined),
          ctaLabel:
            input.ctaLabel || (intent === "invite" ? invite.ctaLabel : undefined),
          secondaryUrl:
            input.secondaryUrl ||
            (intent === "invite" ? `${siteUrl}${invite.secondaryPath}` : undefined),
          secondaryLabel:
            input.secondaryLabel ||
            (intent === "invite" ? invite.secondaryLabel : undefined),
          siteUrl,
          eyebrow:
            input.eyebrow || (intent === "invite" ? invite.eyebrow : undefined),
          greetingName: input.greetingName,
          bullets: input.bullets,
          expiryNote: input.expiryNote,
          recipientNote:
            input.recipientNote ||
            (intent === "invite" ? invite.recipientNote : undefined),
          signOff: input.signOff || (intent === "invite" ? invite.signOff : undefined),
          signOffRole:
            input.signOffRole ||
            (intent === "invite" ? invite.signOffRole : undefined),
          pricingCards,
          logoCid: logoAttachment ? DEFAULT_MAIL_LOGO_CID : undefined,
          logoSrc: mailLogoPublicUrl(siteUrl),
        })
      : undefined);

  const id = uid("mail");
  const at = new Date().toISOString();
  const record: MailMessage = {
    id,
    mailbox: from,
    from,
    to,
    subject,
    text,
    html,
    at,
    direction: "outbound",
    bulk: Boolean(input.bulk),
    templateId: useDefaultTemplate ? DEFAULT_MAIL_TEMPLATE_ID : undefined,
  };

  const warnings: string[] = [];
  const errors: string[] = [];
  let delivered: "smtp" | "local" = "local";
  let accepted: string[] = [];
  let rejected: string[] = [];
  let response: string | undefined;
  let messageId: string | undefined;

  try {
    const smtpReady = await ensureLocalSmtp();
    if (!smtpReady) {
      throw new Error(
        smtpUnavailableHint(`ECONNREFUSED ${process.env.HARAKA_HOST || "127.0.0.1"}:${process.env.HARAKA_PORT || 587}`)
      );
    }

    const tx = smtpTransport();
    const info = (await tx.sendMail({
      from,
      to,
      subject,
      text,
      html,
      attachments: inlineAttachments.length
        ? inlineAttachments.map((att) => ({
            filename: att.filename,
            content: att.content,
            cid: att.cid,
            contentType: att.contentType,
            contentDisposition: att.contentDisposition,
          }))
        : undefined,
    })) as SentMessageInfo;

    delivered = "smtp";
    accepted = asStringList(info.accepted);
    rejected = asStringList(info.rejected);
    response = typeof info.response === "string" ? info.response : undefined;
    messageId = typeof info.messageId === "string" ? info.messageId : undefined;

    if (rejected.length) {
      warnings.push(`SMTP rejected ${rejected.length} recipient(s): ${rejected.join(", ")}`);
    }
    const pending = asStringList((info as { pending?: unknown }).pending);
    if (pending.length) {
      warnings.push(`SMTP deferred ${pending.length} recipient(s): ${pending.join(", ")}`);
    }
    const hint = smtpCodeHint(response);
    if (hint === "warn") {
      warnings.push(`SMTP warning response: ${response}`);
    } else if (hint === "error") {
      errors.push(`SMTP error response: ${response}`);
    }
    if (!accepted.length && to.length) {
      warnings.push("SMTP accepted zero recipients; message may not have been delivered");
    }
    if (response && /relay incomplete|stored locally/i.test(response)) {
      warnings.push(
        "Local SMTP stored the message but external MX relay was incomplete — recipient inboxes may not have received it"
      );
    }
    const external = to.filter(
      (addr) => !addr.endsWith("@octivate.io") && !addr.endsWith("@members.octivate.io")
    );
    if (external.length && response && /^250\b/.test(response) && !/relay incomplete/i.test(response)) {
      // Accepted by local submission — delivery to Gmail/etc. still depends on MX relay + DNS (SPF/DKIM).
      warnings.push(
        `Outbound to ${external.length} external address(es) accepted by mail.octivate.io — confirm arrival in the recipient inbox (Cloudflare MX/SPF/DKIM must align)`
      );
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const msg = smtpUnavailableHint(raw);
    errors.push(`SMTP send failed: ${msg}`);
    delivered = "local";
    warnings.push("Queued locally because SMTP was unavailable or rejected the transaction");
  }

  const senderBox = await readMailbox(from);
  senderBox.unshift(record);
  await writeMailbox(from, senderBox.slice(0, 500));
  await appendOutbox(record);

  for (const recipient of to) {
    if (!recipient.endsWith("@octivate.io") && !recipient.endsWith("@members.octivate.io")) {
      continue;
    }
    const box = await readMailbox(recipient);
    box.unshift({
      ...record,
      id: uid("mail"),
      mailbox: recipient,
      direction: "inbound",
    });
    await writeMailbox(recipient, box.slice(0, 500));
  }

  const level = errors.length ? "error" : warnings.length ? "warn" : "info";
  void emitOpsEvent({
    level,
    source: "mail",
    message:
      delivered === "smtp"
        ? `Mail ${errors.length ? "sent with issues" : "sent"} via Haraka to ${to.length} recipient(s)`
        : `Mail queued locally (Haraka offline/error) for ${to.length} recipient(s)`,
    meta: {
      id,
      from,
      to,
      subject,
      delivered,
      accepted,
      rejected,
      response,
      messageId,
      warnings,
      errors,
      bulk: Boolean(input.bulk),
      templateId: useDefaultTemplate ? DEFAULT_MAIL_TEMPLATE_ID : null,
      templateName: useDefaultTemplate ? DEFAULT_MAIL_TEMPLATE_NAME : null,
    },
  });

  return {
    delivered,
    id,
    accepted,
    rejected,
    response,
    messageId,
    warnings,
    errors,
    templateId: useDefaultTemplate ? DEFAULT_MAIL_TEMPLATE_ID : "custom",
    templateName: useDefaultTemplate ? DEFAULT_MAIL_TEMPLATE_NAME : "Custom / plain",
  };
}

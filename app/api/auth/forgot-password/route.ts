import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { findUserByEmail } from "@/lib/auth/users";
import { createPasswordReset } from "@/lib/auth/password-reset";
import { sendMail } from "@/lib/mail/store";
import { emitOpsEvent } from "@/lib/ops/event-log";
import { clientIp } from "@/lib/security/api-key";

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { publicMutation: true });
  if (denied) return denied;

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    return jsonError("A valid email is required");
  }

  const user = await findUserByEmail(email);
  // Always return success to avoid account enumeration.
  const generic = {
    ok: true,
    message:
      "If an account exists for that email, password reset instructions have been sent.",
  };

  if (!user || user.disabled) {
    return jsonOk(generic);
  }

  try {
    const { token } = await createPasswordReset(user.id, user.email);
    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://octivate.io";
    const site = origin.replace(/\/$/, "");
    const resetUrl = `${site}/signin?reset=${encodeURIComponent(token)}`;
    const greetingName =
      (user.displayName || user.username || "").trim() || "there";

    await sendMail({
      from: process.env.MAIL_FROM || "no-reply@octivate.io",
      to: [user.email],
      subject: "Reset your Octivate password",
      text: [
        `Hi ${greetingName},`,
        "",
        "You requested a password reset for your Octivate account.",
        "",
        "Open this link within one hour to choose a new password:",
        resetUrl,
        "",
        "What happens next:",
        "1. Open the secure reset link",
        "2. Choose a new password",
        "3. Sign back in to your workspace",
        "",
        "If you did not request this, you can ignore this email — your password will stay the same.",
      ].join("\n"),
      useDefaultTemplate: true,
      intent: "transactional",
      preheader: "Choose a new password — link expires in one hour.",
      eyebrow: "Password reset",
      greetingName,
      ctaUrl: resetUrl,
      ctaLabel: "Reset password",
      expiryNote: "This reset link expires in one hour.",
      bullets: [
        "Open the secure reset link above",
        "Choose a new password for your account",
        "Sign back in to your Octivate workspace",
      ],
      recipientNote:
        "You're receiving this because a password reset was requested for your Octivate account. If you didn't ask for this, you can safely ignore this email.",
      siteUrl: site,
    });

    void emitOpsEvent({
      level: "info",
      source: "security",
      message: "password_reset_requested",
      meta: { userId: user.id, ip: clientIp(req) },
    });
  } catch (err) {
    void emitOpsEvent({
      level: "warn",
      source: "security",
      message: "password_reset_mail_failed",
      meta: {
        userId: user.id,
        error: err instanceof Error ? err.message : "unknown",
      },
    });
  }

  return jsonOk(generic);
}

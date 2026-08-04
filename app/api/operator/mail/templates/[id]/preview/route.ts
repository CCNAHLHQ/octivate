import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { renderDefaultMailHtml } from "@/lib/mail/default-template";
import { findMailTemplate } from "@/lib/mail/templates-store";
import { previewMailTemplateSchema } from "@/lib/validation/schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const { id } = await params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* optional draft overrides */
  }

  const parsed = previewMailTemplateSchema.safeParse(body ?? {});
  if (!parsed.success) return jsonError(parsed.error.message);

  const stored = id === "draft" ? null : await findMailTemplate(id);
  if (id !== "draft" && !stored) return jsonError("Template not found", 404);

  const subject = parsed.data.subject ?? stored?.subject ?? "Preview";
  const text = parsed.data.text ?? stored?.text ?? "";
  if (!text.trim()) return jsonError("Body text is required for preview");

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://octivate.io";
  const from =
    parsed.data.from ||
    process.env.MAIL_FROM ||
    "no-reply@octivate.io";

  const { loadMailPricingCards } = await import("@/lib/mail/invite-defaults");
  const pricingCards = await loadMailPricingCards();

  const html = renderDefaultMailHtml({
    subject,
    text,
    from,
    intent: "invite",
    preheader: parsed.data.preheader ?? stored?.preheader,
    eyebrow: parsed.data.eyebrow ?? stored?.eyebrow,
    bullets: parsed.data.bullets ?? stored?.bullets,
    ctaUrl: parsed.data.ctaUrl ?? stored?.ctaUrl,
    ctaLabel: parsed.data.ctaLabel ?? stored?.ctaLabel,
    signOff: parsed.data.signOff ?? stored?.signOff,
    signOffRole: parsed.data.signOffRole ?? stored?.signOffRole,
    pricingCards,
    siteUrl: site,
    // Preview in browser: prefer absolute PNG (no SMTP CID session).
    logoSrc: `${site}/email/octivate-lockup.png`,
  });

  return jsonOk({
    html,
    templateId: stored?.id ?? null,
    subject,
  });
}
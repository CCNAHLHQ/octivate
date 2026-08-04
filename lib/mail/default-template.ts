/**
 * Default branded HTML wrapper for Octivate outbound mail.
 * Invite-first SaaS shell with tutorial-style cards and live pricing.
 */

import {
  defaultInviteCopy,
  defaultInviteFeatureCards,
  type MailFeatureCard,
  type MailIntent,
  type MailPricingCard,
} from "@/lib/mail/invite-defaults";

export const DEFAULT_MAIL_TEMPLATE_ID = "octivate-default";
export const DEFAULT_MAIL_TEMPLATE_NAME = "Octivate";
/** Inline CID used when sendMail attaches public/email/octivate-lockup.png */
export const DEFAULT_MAIL_LOGO_CID = "octivate-logo@octivate";

const ACCENT = {
  violet: "#8950EE",
  tide: "#4D9DF7",
  coral: "#ED6D6C",
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape text, then turn bare https URLs into links. */
function linkifyEscaped(escaped: string): string {
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#4D9DF7;text-decoration:underline;">$1</a>'
  );
}

function paragraphs(text: string): string {
  const chunks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!chunks.length) return '<p style="margin:0;"></p>';
  return chunks
    .map((p) => {
      const html = linkifyEscaped(escapeHtml(p)).replace(/\n/g, "<br/>");
      return `<p style="margin:0 0 1em;font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.65;color:#9AA6AD;">${html}</p>`;
    })
    .join("\n");
}

export type DefaultMailTemplateInput = {
  subject: string;
  text: string;
  from: string;
  preheader?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  /** Secondary text link under the primary CTA. */
  secondaryUrl?: string;
  secondaryLabel?: string;
  siteUrl?: string;
  eyebrow?: string;
  greetingName?: string;
  bullets?: string[];
  expiryNote?: string;
  logoCid?: string;
  logoSrc?: string;
  recipientNote?: string;
  signOff?: string;
  signOffRole?: string;
  /** invite (default) shows feature cards + pricing; transactional hides them. */
  intent?: MailIntent;
  featureCards?: MailFeatureCard[];
  pricingCards?: MailPricingCard[];
  showFeatureCards?: boolean;
  showPricing?: boolean;
};

function resolveAbsolute(site: string, url?: string): string {
  const raw = (url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${site}${raw}`;
  if (raw.startsWith("#")) return `${site}/${raw}`;
  return raw;
}

function featureCardsHtml(cards: MailFeatureCard[], preferCid: boolean): string {
  if (!cards.length) return "";
  const rows = cards
    .map((card) => {
      const accent = ACCENT[card.accent] || ACCENT.tide;
      const iconSrc =
        preferCid && card.iconCid
          ? `cid:${escapeHtml(card.iconCid)}`
          : escapeHtml(card.iconSrc || "");
      const iconCell = iconSrc
        ? `<td width="40" valign="top" style="padding:0 14px 0 0;">
            <img src="${iconSrc}" width="28" height="28" alt="" style="display:block;width:28px;height:28px;border:0;border-radius:999px;" />
          </td>`
        : "";
      return `
        <tr>
          <td style="padding:0 0 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#101B31;border:1px solid rgba(77,157,247,0.14);border-radius:10px;border-left:3px solid ${accent};">
              <tr>
                <td style="padding:16px 18px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      ${iconCell}
                      <td valign="top">
                        <p style="margin:0 0 4px;font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${accent};">${escapeHtml(card.kicker)}</p>
                        <p style="margin:0 0 6px;font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:16px;font-weight:700;line-height:1.3;color:#F8FBFC;">${escapeHtml(card.title)}</p>
                        <p style="margin:0;font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.55;color:#9AA6AD;">${escapeHtml(card.body)}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join("");

  return `
        <tr>
          <td class="px" style="background:#0E151B;padding:8px 40px 6px;border-left:1px solid rgba(77,157,247,0.12);border-right:1px solid rgba(77,157,247,0.12);">
            <p style="font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#9AA6AD;margin:0 0 14px;">What you get</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
          </td>
        </tr>`;
}

function pricingCardsHtml(cards: MailPricingCard[], pricingUrl: string): string {
  if (!cards.length) return "";
  const cells = cards
    .map((card) => {
      const border = card.featured
        ? "border:1px solid rgba(137,80,238,0.45);"
        : "border:1px solid rgba(77,157,247,0.14);";
      const badge = card.badge
        ? `<p style="margin:0 0 8px;font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#8950EE;">${escapeHtml(card.badge)}</p>`
        : `<p style="margin:0 0 8px;font-size:10px;line-height:1;color:transparent;">.</p>`;
      return `
        <td width="33%" valign="top" style="padding:4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#101B31;${border}border-radius:10px;">
            <tr>
              <td style="padding:14px 12px;text-align:center;">
                ${badge}
                <p style="margin:0 0 6px;font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:700;color:#F8FBFC;">${escapeHtml(card.name)}</p>
                <p style="margin:0 0 2px;font-family:'Instrument Serif',Georgia,'Times New Roman',serif;font-size:26px;line-height:1;color:#F8FBFC;">${escapeHtml(card.priceLabel)}<span style="font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#9AA6AD;">${card.unitLabel ? ` ${escapeHtml(card.unitLabel)}` : ""}</span></p>
                <p style="margin:10px 0 0;font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:11px;line-height:1.45;color:#9AA6AD;">${escapeHtml(card.description)}</p>
              </td>
            </tr>
          </table>
        </td>`;
    })
    .join("");

  return `
        <tr>
          <td class="px" style="background:#0E151B;padding:18px 40px 6px;border-left:1px solid rgba(77,157,247,0.12);border-right:1px solid rgba(77,157,247,0.12);">
            <p style="font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#9AA6AD;margin:0 0 6px;">Simple pricing</p>
            <p style="font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.5;color:#9AA6AD;margin:0 0 14px;">Start free, buy a scoped brief, or keep the full workspace with team access.</p>
            <table role="presentation" class="price-row" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>
            <p style="margin:14px 0 0;text-align:center;font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:12px;">
              <a href="${escapeHtml(pricingUrl)}" style="color:#4D9DF7;text-decoration:underline;">Compare plans on octivate.io/pricing</a>
            </p>
          </td>
        </tr>`;
}

/** Branded HTML email shell used for invites, forgot-password, and operator outbound mail. */
export function renderDefaultMailHtml(input: DefaultMailTemplateInput): string {
  const intent: MailIntent = input.intent || "invite";
  const invite = defaultInviteCopy(input.greetingName);
  const site = (input.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://octivate.io")
    .replace(/\/$/, "");
  const siteEsc = escapeHtml(site);

  const subjectRaw = (input.subject || invite.subject).slice(0, 200);
  const subject = escapeHtml(subjectRaw);
  const from = escapeHtml(input.from);
  const textRaw = (input.text || invite.text).slice(0, 20000);
  const preheader = escapeHtml(
    (input.preheader || invite.preheader || textRaw)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 140)
  );

  const year = new Date().getUTCFullYear();
  const mailingUrl = escapeHtml(`${site}/#mailing`);
  const pricingUrl = `${site}/pricing`;

  let ctaUrl = resolveAbsolute(site, input.ctaUrl || (intent === "invite" ? invite.ctaPath : ""));
  const ctaLabel = escapeHtml(
    (input.ctaLabel || (intent === "invite" ? invite.ctaLabel : "Continue")).slice(0, 80)
  );
  const secondaryUrl = resolveAbsolute(
    site,
    input.secondaryUrl || (intent === "invite" ? invite.secondaryPath : "")
  );
  const secondaryLabel = escapeHtml(
    (input.secondaryLabel || invite.secondaryLabel).slice(0, 80)
  );

  const signOff = escapeHtml((input.signOff || invite.signOff).slice(0, 80));
  const signOffRole = escapeHtml(
    (input.signOffRole || invite.signOffRole).slice(0, 120)
  );
  const eyebrow = escapeHtml(
    (input.eyebrow || (intent === "invite" ? invite.eyebrow : "Octivate")).slice(0, 60)
  );

  const greetingRaw = input.greetingName?.trim().slice(0, 80) || "";
  const greetingName = greetingRaw ? escapeHtml(greetingRaw) : "";
  let bodyText = textRaw;
  if (greetingRaw) {
    const greetRe = new RegExp(
      `^Hi\\s+${greetingRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*,?\\s*(\\n+|$)`,
      "i"
    );
    bodyText = bodyText.replace(greetRe, "").trimStart();
  }
  // Also strip generic "Hello," opener when invite copy supplies greeting headline.
  if (intent === "invite" && !greetingRaw) {
    bodyText = bodyText.replace(/^Hello,\s*(\n+|$)/i, "").trimStart();
  }
  const body = paragraphs(bodyText);

  const expiryNote = input.expiryNote?.trim()
    ? escapeHtml(input.expiryNote.trim().slice(0, 160))
    : "";

  const logoCid = input.logoCid?.trim() || "";
  const logoSrc = escapeHtml(
    (input.logoSrc || `${site}/email/octivate-lockup.png`).trim()
  );
  const logoImgSrc = logoCid ? `cid:${escapeHtml(logoCid)}` : logoSrc;

  const recipientNote = escapeHtml(
    (
      input.recipientNote ||
      (intent === "invite"
        ? invite.recipientNote
        : `You're receiving this from Octivate (${input.from}). If you weren't expecting it, you can safely ignore this email.`)
    ).slice(0, 320)
  );

  const showFeatureCards =
    input.showFeatureCards ?? intent === "invite";
  const showPricing = input.showPricing ?? intent === "invite";

  const featureCards =
    input.featureCards ||
    (showFeatureCards ? defaultInviteFeatureCards(site) : []);
  const pricingCards = showPricing ? input.pricingCards || [] : [];

  const bullets = (input.bullets || [])
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 8);

  const bulletRows = bullets.length
    ? bullets
        .map(
          (b) => `
            <tr>
              <td style="padding:6px 0;color:#4D9DF7;width:24px;vertical-align:top;font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:14px;">→</td>
              <td style="padding:6px 0;font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:14px;line-height:1.45;color:#F8FBFC;">${escapeHtml(b)}</td>
            </tr>`
        )
        .join("")
    : "";

  const bulletsBlock =
    bulletRows && intent === "transactional"
      ? `
        <tr>
          <td class="px" style="background:#0E151B;padding:22px 40px 6px;border-left:1px solid rgba(77,157,247,0.12);border-right:1px solid rgba(77,157,247,0.12);">
            <p style="font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#9AA6AD;margin:0 0 14px;">What happens next</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${bulletRows}</table>
          </td>
        </tr>`
      : "";

  const ctaBlock =
    ctaUrl && /^https?:\/\//i.test(ctaUrl)
      ? `
        <tr>
          <td class="px" style="background:#0E151B;padding:24px 40px 6px;border-left:1px solid rgba(77,157,247,0.12);border-right:1px solid rgba(77,157,247,0.12);">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="background:#4D9DF7;border-radius:6px;box-shadow:0 8px 30px rgba(77,157,247,0.35);padding:0;">
                  <a href="${escapeHtml(ctaUrl)}" style="display:block;font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#070B17;padding:16px 32px;text-decoration:none;">${ctaLabel}</a>
                </td>
              </tr>
            </table>
            ${
              secondaryUrl
                ? `<p style="margin:16px 0 0;text-align:center;font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:13px;">
              <a href="${escapeHtml(secondaryUrl)}" style="color:#4D9DF7;text-decoration:underline;">${secondaryLabel}</a>
            </p>`
                : ""
            }
          </td>
        </tr>`
      : "";

  const expiryBlock = expiryNote
    ? `
        <tr>
          <td class="px" style="background:#0E151B;padding:12px 40px 0;border-left:1px solid rgba(77,157,247,0.12);border-right:1px solid rgba(77,157,247,0.12);">
            <p style="font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.6;color:#9AA6AD;margin:0;">${expiryNote}</p>
          </td>
        </tr>`
    : "";

  const headline = greetingName
    ? `Hi <span style="font-style:italic;color:#4D9DF7;">${greetingName}</span>,`
    : intent === "invite"
      ? escapeHtml(invite.headline || subjectRaw)
      : subject;

  const navLink = (href: string, label: string) =>
    `<a href="${escapeHtml(href)}" style="font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:600;color:#9AA6AD;text-decoration:none;padding:0 8px;">${escapeHtml(label)}</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${subject}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;family=Instrument+Serif:ital@0;1&amp;display=swap');
  body{margin:0;padding:0;background:#070B17;}
  a{text-decoration:none;}
  @media (max-width:620px){
    .container{width:100% !important;}
    .px{padding-left:24px !important;padding-right:24px !important;}
    .h1{font-size:30px !important;}
    .nav-links{display:none !important;}
    .price-row td{display:block !important;width:100% !important;padding:0 0 10px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#070B17;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#070B17;mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070B17;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">

        <tr><td style="height:5px;line-height:5px;font-size:0;background:linear-gradient(90deg,#8950EE 0%,#ED6D6C 50%,#4D9DF7 100%);border-radius:14px 14px 0 0;">&nbsp;</td></tr>

        <tr>
          <td class="px" style="background:#0A1118;padding:20px 40px 16px;border-left:1px solid rgba(77,157,247,0.12);border-right:1px solid rgba(77,157,247,0.12);">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td valign="middle" style="padding-right:12px;">
                  <a href="${siteEsc}" style="display:inline-block;text-decoration:none;">
                    <img src="${logoImgSrc}" width="168" height="32" alt="Octivate" style="display:block;width:168px;height:auto;max-height:36px;border:0;outline:none;background:transparent;" />
                  </a>
                </td>
                <td class="nav-links" valign="middle" align="right" style="white-space:nowrap;">
                  ${navLink(`${site}/#why`, "Why")}
                  ${navLink(`${site}/#how`, "How")}
                  ${navLink(`${site}/pricing`, "Pricing")}
                  ${navLink(`${site}/sample/brief`, "Sample")}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="px" style="background:#0E151B;padding:34px 40px 0;border-left:1px solid rgba(77,157,247,0.12);border-right:1px solid rgba(77,157,247,0.12);">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td width="32" style="padding-right:12px;"><div style="height:1px;background:#4D9DF7;opacity:0.55;font-size:0;line-height:1px;">&nbsp;</div></td>
              <td style="font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#4D9DF7;">${eyebrow}</td>
            </tr></table>
            <h1 class="h1" style="font-family:'Instrument Serif',Georgia,'Times New Roman',serif;font-weight:400;font-size:38px;line-height:1.14;color:#F8FBFC;margin:20px 0 10px;">${headline}</h1>
            <div style="font-family:Inter,'Helvetica Neue',Arial,sans-serif;">
              ${body}
            </div>
          </td>
        </tr>

        <tr><td class="px" style="background:#0E151B;padding:12px 40px 0;border-left:1px solid rgba(77,157,247,0.12);border-right:1px solid rgba(77,157,247,0.12);"><div style="height:1px;background:rgba(77,157,247,0.12);font-size:0;line-height:1px;">&nbsp;</div></td></tr>

        ${showFeatureCards ? featureCardsHtml(featureCards, Boolean(logoCid)) : ""}
        ${showPricing ? pricingCardsHtml(pricingCards, pricingUrl) : ""}
        ${ctaBlock}
        ${expiryBlock}
        ${bulletsBlock}

        <tr>
          <td class="px" style="background:#0E151B;padding:0 40px 34px;border-left:1px solid rgba(77,157,247,0.12);border-right:1px solid rgba(77,157,247,0.12);border-radius:0 0 14px 14px;">
            <div style="height:1px;background:rgba(77,157,247,0.12);font-size:0;line-height:1px;margin:22px 0 20px;">&nbsp;</div>
            <p style="font-family:'Instrument Serif',Georgia,'Times New Roman',serif;font-style:italic;font-size:21px;color:#F8FBFC;margin:0 0 2px;">${signOff}</p>
            <p style="font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#9AA6AD;margin:0;">${signOffRole}</p>
          </td>
        </tr>

        <tr>
          <td class="px" align="center" style="padding:28px 32px 8px;">
            <p style="font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:13px;line-height:1.55;color:#9AA6AD;margin:0 0 16px;max-width:480px;">
              Action-oriented decision intelligence for complex Caribbean operating environments.
            </p>
            <p style="font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.8;margin:0 0 14px;">
              <a href="${siteEsc}/#why" style="color:#4D9DF7;text-decoration:none;">Why Octivate</a>
              <span style="color:#5d666d;"> · </span>
              <a href="${siteEsc}/#how" style="color:#4D9DF7;text-decoration:none;">How it works</a>
              <span style="color:#5d666d;"> · </span>
              <a href="${siteEsc}/pricing" style="color:#4D9DF7;text-decoration:none;">Pricing</a>
              <span style="color:#5d666d;"> · </span>
              <a href="${siteEsc}/sample/brief" style="color:#4D9DF7;text-decoration:none;">Sample brief</a>
              <span style="color:#5d666d;"> · </span>
              <a href="${siteEsc}/#contact" style="color:#4D9DF7;text-decoration:none;">Request a Demo</a>
              <span style="color:#5d666d;"> · </span>
              <a href="${siteEsc}/signup" style="color:#4D9DF7;text-decoration:none;">Start free</a>
              <span style="color:#5d666d;"> · </span>
              <a href="${siteEsc}/signin" style="color:#4D9DF7;text-decoration:none;">Sign in</a>
              <span style="color:#5d666d;"> · </span>
              <a href="${siteEsc}/support" style="color:#4D9DF7;text-decoration:none;">Team</a>
              <span style="color:#5d666d;"> · </span>
              <a href="https://censii.co" style="color:#4D9DF7;text-decoration:none;">About CENSII</a>
              <span style="color:#5d666d;"> · </span>
              <a href="mailto:info@censii.co" style="color:#4D9DF7;text-decoration:none;">Contact</a>
            </p>
            <p style="font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.6;color:#5d666d;margin:0 0 10px;">
              ${recipientNote}
            </p>
            <p style="font-family:Inter,'Helvetica Neue',Arial,sans-serif;font-size:11px;line-height:1.5;color:#5d666d;margin:0;">
              © ${year} CENSII · Octivate ·
              <a href="${siteEsc}" style="color:#4D9DF7;text-decoration:none;">octivate.io</a>
              ·
              <a href="${mailingUrl}" style="color:#5d666d;text-decoration:underline;">Mailing preferences</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

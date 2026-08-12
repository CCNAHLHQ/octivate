import { PAGE_LANGUAGE } from "@/lib/i18n/languages";
import { NAV_MESSAGES } from "@/lib/i18n/registry/nav";
import { MAILING_MESSAGES } from "@/lib/i18n/registry/mailing";
import { LAND_MESSAGES } from "@/lib/i18n/registry/land";
import { FOOTER_MESSAGES } from "@/lib/i18n/registry/footer";
import { AUTH_MESSAGES } from "@/lib/i18n/registry/auth";
import { WS_MESSAGES } from "@/lib/i18n/registry/ws";
import { WS_UI_MESSAGES } from "@/lib/i18n/registry/ws-ui";
import { OP_MESSAGES } from "@/lib/i18n/registry/op";
import { OP_UI_MESSAGES } from "@/lib/i18n/registry/op-ui";
import { SUPPORT_MESSAGES } from "@/lib/i18n/registry/support";
import { ONBOARD_MESSAGES } from "@/lib/i18n/registry/onboard";
import { COMMON_MESSAGES } from "@/lib/i18n/registry/common";
import { PRICING_MESSAGES } from "@/lib/i18n/registry/pricing";
import { COOKIE_MESSAGES } from "@/lib/i18n/registry/cookie";
import { LEGAL_MESSAGES } from "@/lib/i18n/registry/legal";

/** Curated English source of truth — static UI across marketing, auth, workspace, operator. */
export const EN_MESSAGES = {
  ...NAV_MESSAGES,
  ...MAILING_MESSAGES,
  ...LAND_MESSAGES,
  ...FOOTER_MESSAGES,
  ...AUTH_MESSAGES,
  ...WS_MESSAGES,
  ...WS_UI_MESSAGES,
  ...OP_MESSAGES,
  ...OP_UI_MESSAGES,
  ...SUPPORT_MESSAGES,
  ...ONBOARD_MESSAGES,
  ...COMMON_MESSAGES,
  ...PRICING_MESSAGES,
  ...COOKIE_MESSAGES,
  ...LEGAL_MESSAGES,
} as const;

export type MessageKey = keyof typeof EN_MESSAGES;
export type MessageDict = Record<string, string>;

/** Flat English map for sync/catalog (includes only static keys). */
export function getEnglishSource(): MessageDict {
  return { ...EN_MESSAGES };
}

export function isSupportedLocale(locale: string): boolean {
  return locale === PAGE_LANGUAGE || Boolean(locale && locale.length >= 2);
}

export function normalizeLocale(raw: string | null | undefined): string {
  if (!raw) return PAGE_LANGUAGE;
  const cleaned = raw.trim();
  if (!cleaned || cleaned === PAGE_LANGUAGE) return PAGE_LANGUAGE;
  if (cleaned.toLowerCase() === "zh-cn" || cleaned === "zh-CN") return "zh-CN";
  return cleaned;
}

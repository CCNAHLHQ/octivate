import { PAGE_LANGUAGE } from "@/lib/i18n/languages";

/** Curated English source of truth for global UI chrome + mailing. */
export const EN_MESSAGES = {
  "nav.why": "Why Octivate",
  "nav.how": "How it works",
  "nav.pricing": "Pricing",
  "nav.team": "Team",
  "nav.about": "About",
  "nav.signIn": "Sign in",
  "nav.requestDemo": "Request a Demo",
  "nav.returnWorkspace": "Return to workspace",
  "nav.operatorDashboard": "Operator dashboard",
  "nav.askQuestion": "Ask question",
  "nav.askQuestionLong": "Ask a question",
  "nav.skip": "Skip to content",
  "nav.explore": "Explore",
  "nav.openMenu": "Open menu",
  "nav.closeMenu": "Close menu",
  "nav.translate": "Translate",
  "nav.primary": "Primary",
  "nav.mobile": "Mobile",

  "mailing.eyebrow": "Stay in the loop",
  "mailing.title": "Join the Octivate mailing list",
  "mailing.lede":
    "Short notes on Caribbean decision intelligence, product releases, and design-partner openings — no spam, no sales sequences.",
  "mailing.benefit.updates": "Early access to workspace updates",
  "mailing.benefit.notes": "Occasional brief methodology notes from CENSII",
  "mailing.benefit.unsubscribe": "Unsubscribe any time — one click, no questions",
  "mailing.email": "Work email",
  "mailing.name": "Name",
  "mailing.nameOptional": "(optional)",
  "mailing.emailPlaceholder": "you@organisation.org",
  "mailing.namePlaceholder": "First name",
  "mailing.consent":
    "I agree to receive occasional Octivate emails. I can opt out freely at any time.",
  "mailing.join": "Join the list",
  "mailing.saving": "Saving…",
  "mailing.optOut": "Opt out",
  "mailing.fine": "Stored server-side for Octivate / CENSII only. We never sell your address.",
  "mailing.consentRequired": "Please confirm you want product updates.",
  "mailing.success": "You're on the list — occasional product notes only.",
  "mailing.unsubscribed": "You're off the list. You can rejoin any time.",
  "mailing.networkError": "Network error. Check your connection and try again.",
  "mailing.genericError": "Something went wrong. Try again.",
} as const;

export type MessageKey = keyof typeof EN_MESSAGES;
export type MessageDict = Record<string, string>;

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

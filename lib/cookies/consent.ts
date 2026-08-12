export const COOKIE_CONSENT_KEY = "octivate-cookie-consent";
export const COOKIE_SETTINGS_EVENT = "octivate:cookie-settings";

export type CookieConsent = {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

export function defaultConsent(partial?: Partial<Omit<CookieConsent, "essential">>): CookieConsent {
  return {
    essential: true,
    analytics: partial?.analytics ?? false,
    marketing: partial?.marketing ?? false,
    updatedAt: partial?.updatedAt ?? new Date().toISOString(),
  };
}

export function getConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (typeof parsed !== "object" || parsed === null) return null;
    return defaultConsent({
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
    });
  } catch {
    return null;
  }
}

export function hasAnswered(): boolean {
  return getConsent() !== null;
}

export function setConsent(next: Omit<CookieConsent, "essential" | "updatedAt"> & {
  analytics: boolean;
  marketing: boolean;
}): CookieConsent {
  const value = defaultConsent({
    analytics: next.analytics,
    marketing: next.marketing,
    updatedAt: new Date().toISOString(),
  });
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COOKIE_SETTINGS_EVENT, { detail: { type: "saved", value } }));
  }
  return value;
}

export function openCookieSettings() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COOKIE_SETTINGS_EVENT, { detail: { type: "open" } }));
}

export function isPublicCookieRoute(pathname: string): boolean {
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/operator")) return false;
  return true;
}

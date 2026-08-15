import { parseUserAgent } from "@/lib/support/client-meta";

/** Browser / network telemetry captured at checkout submit. */
export type MerchantClientContext = {
  userAgent?: string;
  browser?: string;
  os?: string;
  language?: string;
  languages?: string;
  platform?: string;
  screenW?: number;
  screenH?: number;
  availW?: number;
  availH?: number;
  viewportW?: number;
  viewportH?: number;
  devicePixelRatio?: number;
  colorDepth?: number;
  timezone?: string;
  timezoneOffsetMin?: number;
  referrer?: string;
  pageUrl?: string;
  landingUrl?: string;
  navigationType?: string;
  redirectCount?: number;
  colorScheme?: "light" | "dark" | "unknown";
  touchPoints?: number;
  connectionType?: string;
  /** Client wall-clock at submit (ISO) */
  clientSubmittedAt?: string;
  /** Server-enriched */
  ip?: string;
  acceptLanguage?: string;
  cfCountry?: string;
  cfRay?: string;
  serverReceivedAt?: string;
};

const LANDING_KEY = "octivate-checkout-landing";
const HOPS_KEY = "octivate-nav-hops";

function clampStr(v: unknown, max: number) {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  return s.slice(0, max);
}

function clampNum(v: unknown, min = 0, max = 100_000) {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Call once on public pages so landing URL + hop count are available at checkout. */
export function touchCheckoutNavigationTrail() {
  if (typeof window === "undefined") return;
  try {
    if (!sessionStorage.getItem(LANDING_KEY)) {
      sessionStorage.setItem(LANDING_KEY, window.location.href);
    }
    const hops = Number(sessionStorage.getItem(HOPS_KEY) || "0") || 0;
    sessionStorage.setItem(HOPS_KEY, String(hops + 1));
  } catch {
    /* private mode */
  }
}

/** Collect client-side context for merchant fraud / analytics review. */
export function collectCheckoutClientContext(): MerchantClientContext {
  if (typeof window === "undefined") return {};

  let landingUrl: string | undefined;
  let redirectCount: number | undefined;
  try {
    landingUrl = sessionStorage.getItem(LANDING_KEY) || undefined;
    const hops = Number(sessionStorage.getItem(HOPS_KEY) || "0");
    if (Number.isFinite(hops)) redirectCount = hops;
  } catch {
    /* ignore */
  }

  let navigationType: string | undefined;
  try {
    const nav = performance.getEntriesByType?.(
      "navigation"
    )?.[0] as PerformanceNavigationTiming | undefined;
    navigationType = nav?.type || undefined;
  } catch {
    /* ignore */
  }

  const conn = (
    navigator as Navigator & {
      connection?: { effectiveType?: string };
    }
  ).connection;

  let colorScheme: MerchantClientContext["colorScheme"] = "unknown";
  try {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      colorScheme = "dark";
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      colorScheme = "light";
    }
  } catch {
    /* ignore */
  }

  const ua = navigator.userAgent || "";
  const parsed = parseUserAgent(ua);

  return {
    userAgent: clampStr(ua, 512),
    browser: parsed.browser,
    os: parsed.os,
    language: clampStr(navigator.language, 32),
    languages: clampStr((navigator.languages || []).join(","), 120),
    platform: clampStr(navigator.platform, 64),
    screenW: clampNum(screen.width),
    screenH: clampNum(screen.height),
    availW: clampNum(screen.availWidth),
    availH: clampNum(screen.availHeight),
    viewportW: clampNum(window.innerWidth),
    viewportH: clampNum(window.innerHeight),
    devicePixelRatio: Number.isFinite(window.devicePixelRatio)
      ? Math.round(window.devicePixelRatio * 100) / 100
      : undefined,
    colorDepth: clampNum(screen.colorDepth, 1, 64),
    timezone: clampStr(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      64
    ),
    timezoneOffsetMin: new Date().getTimezoneOffset(),
    referrer: clampStr(document.referrer, 500),
    pageUrl: clampStr(window.location.href, 500),
    landingUrl: clampStr(landingUrl, 500),
    navigationType: clampStr(navigationType, 32),
    redirectCount,
    colorScheme,
    touchPoints: clampNum(navigator.maxTouchPoints, 0, 40),
    connectionType: clampStr(conn?.effectiveType, 32),
    clientSubmittedAt: new Date().toISOString(),
  };
}

export function sanitizeClientContext(
  raw: unknown
): MerchantClientContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const next: MerchantClientContext = {
    userAgent: clampStr(o.userAgent, 512),
    browser: clampStr(o.browser, 40),
    os: clampStr(o.os, 40),
    language: clampStr(o.language, 32),
    languages: clampStr(o.languages, 120),
    platform: clampStr(o.platform, 64),
    screenW: clampNum(o.screenW),
    screenH: clampNum(o.screenH),
    availW: clampNum(o.availW),
    availH: clampNum(o.availH),
    viewportW: clampNum(o.viewportW),
    viewportH: clampNum(o.viewportH),
    devicePixelRatio:
      typeof o.devicePixelRatio === "number" && Number.isFinite(o.devicePixelRatio)
        ? Math.round(o.devicePixelRatio * 100) / 100
        : undefined,
    colorDepth: clampNum(o.colorDepth, 1, 64),
    timezone: clampStr(o.timezone, 64),
    timezoneOffsetMin:
      typeof o.timezoneOffsetMin === "number" &&
      Number.isFinite(o.timezoneOffsetMin)
        ? Math.round(o.timezoneOffsetMin)
        : undefined,
    referrer: clampStr(o.referrer, 500),
    pageUrl: clampStr(o.pageUrl, 500),
    landingUrl: clampStr(o.landingUrl, 500),
    navigationType: clampStr(o.navigationType, 32),
    redirectCount: clampNum(o.redirectCount, 0, 10_000),
    colorScheme:
      o.colorScheme === "light" || o.colorScheme === "dark"
        ? o.colorScheme
        : o.colorScheme === "unknown"
          ? "unknown"
          : undefined,
    touchPoints: clampNum(o.touchPoints, 0, 40),
    connectionType: clampStr(o.connectionType, 32),
    clientSubmittedAt: clampStr(o.clientSubmittedAt, 40),
    ip: clampStr(o.ip, 80),
    acceptLanguage: clampStr(o.acceptLanguage, 160),
    cfCountry: clampStr(o.cfCountry, 8),
    cfRay: clampStr(o.cfRay, 64),
    serverReceivedAt: clampStr(o.serverReceivedAt, 40),
  };

  const hasAny = Object.values(next).some((v) => v !== undefined && v !== "");
  return hasAny ? next : undefined;
}

export function enrichClientContextFromRequest(
  headers: Headers,
  ip: string,
  clientPayload: unknown
): MerchantClientContext {
  const base = sanitizeClientContext(clientPayload) || {};
  const ua = base.userAgent || headers.get("user-agent") || "";
  const parsed = parseUserAgent(ua);
  return {
    ...base,
    userAgent: clampStr(ua, 512),
    browser: base.browser || parsed.browser,
    os: base.os || parsed.os,
    ip: clampStr(ip, 80),
    acceptLanguage: clampStr(headers.get("accept-language"), 160),
    cfCountry: clampStr(headers.get("cf-ipcountry"), 8),
    cfRay: clampStr(headers.get("cf-ray"), 64),
    serverReceivedAt: new Date().toISOString(),
  };
}

export function formatScreenSize(ctx?: MerchantClientContext | null) {
  if (!ctx?.screenW || !ctx?.screenH) return "—";
  const dpr = ctx.devicePixelRatio ? ` @${ctx.devicePixelRatio}x` : "";
  return `${ctx.screenW}×${ctx.screenH}${dpr}`;
}

export function formatViewport(ctx?: MerchantClientContext | null) {
  if (!ctx?.viewportW || !ctx?.viewportH) return "—";
  return `${ctx.viewportW}×${ctx.viewportH}`;
}

export function shortUrl(url?: string | null, max = 42) {
  if (!url) return "—";
  try {
    const u = new URL(url);
    const path = `${u.pathname}${u.search}` || "/";
    const s = `${u.host}${path}`;
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  } catch {
    return url.length > max ? `${url.slice(0, max - 1)}…` : url;
  }
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { EN_MESSAGES, type MessageDict, type MessageKey } from "@/lib/i18n/messages";
import { PAGE_LANGUAGE, TRANSLATE_STORAGE_KEY } from "@/lib/i18n/languages";

type LocaleContextValue = {
  locale: string;
  messages: MessageDict;
  ready: boolean;
  loading: boolean;
  catalogVersion: number;
  t: (key: MessageKey | string, fallback?: string) => string;
  setLocale: (locale: string) => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const SESSION_PREFIX = "octivate_i18n_catalog_v";

function readStoredLocale(): string {
  if (typeof window === "undefined") return PAGE_LANGUAGE;
  try {
    return localStorage.getItem(TRANSLATE_STORAGE_KEY) || PAGE_LANGUAGE;
  } catch {
    return PAGE_LANGUAGE;
  }
}

function persistLocale(locale: string) {
  const maxAge = 60 * 60 * 24 * 365;
  const base = `${TRANSLATE_STORAGE_KEY}=${encodeURIComponent(locale)};path=/;max-age=${maxAge};SameSite=Lax`;
  document.cookie = base;
  const domain = window.location.hostname.replace(/^www\./, "");
  if (domain.includes(".")) {
    document.cookie = `${base};domain=.${domain}`;
  }
  try {
    if (locale === PAGE_LANGUAGE) localStorage.removeItem(TRANSLATE_STORAGE_KEY);
    else localStorage.setItem(TRANSLATE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

function applyDocumentLocale(locale: string) {
  document.documentElement.lang = locale === "zh-CN" ? "zh-CN" : locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
}

function readSessionCatalog(locale: string): { messages: MessageDict; version: number } | null {
  try {
    const raw = sessionStorage.getItem(`${SESSION_PREFIX}${locale}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { messages?: MessageDict; version?: number };
    if (!parsed?.messages) return null;
    return { messages: parsed.messages, version: Number(parsed.version || 0) };
  } catch {
    return null;
  }
}

function writeSessionCatalog(locale: string, messages: MessageDict, version: number) {
  try {
    sessionStorage.setItem(
      `${SESSION_PREFIX}${locale}`,
      JSON.stringify({ messages, version, at: Date.now() })
    );
  } catch {
    /* ignore quota */
  }
}

async function fetchCatalog(
  locale: string,
  signal?: AbortSignal
): Promise<{ messages: MessageDict; version: number }> {
  if (locale === PAGE_LANGUAGE) {
    return { messages: { ...EN_MESSAGES }, version: 0 };
  }
  const res = await fetch(`/api/i18n/catalog?locale=${encodeURIComponent(locale)}`, {
    cache: "default",
    signal,
  });
  if (!res.ok) throw new Error("Failed to load catalog");
  const data = (await res.json()) as {
    messages?: MessageDict;
    meta?: { catalogVersion?: number };
  };
  const messages = { ...EN_MESSAGES, ...(data.messages || {}) };
  const version = Number(data.meta?.catalogVersion || 0);
  writeSessionCatalog(locale, messages, version);
  return { messages, version };
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(PAGE_LANGUAGE);
  const [messages, setMessages] = useState<MessageDict>({ ...EN_MESSAGES });
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const stored = readStoredLocale();
    setLocaleState(stored);
    applyDocumentLocale(stored);
    if (stored === PAGE_LANGUAGE) {
      setMessages({ ...EN_MESSAGES });
      setReady(true);
      return;
    }
    const cached = readSessionCatalog(stored);
    if (cached) {
      setMessages({ ...EN_MESSAGES, ...cached.messages });
      setCatalogVersion(cached.version);
      setReady(true);
    }
    setLoading(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const seq = ++seqRef.current;
    void fetchCatalog(stored, ac.signal)
      .then((dict) => {
        if (seq !== seqRef.current) return;
        setMessages(dict.messages);
        setCatalogVersion(dict.version);
        persistLocale(stored);
      })
      .catch(() => {
        if (seq !== seqRef.current) return;
        if (!cached) setMessages({ ...EN_MESSAGES });
      })
      .finally(() => {
        if (seq !== seqRef.current) return;
        setLoading(false);
        setReady(true);
      });
    return () => ac.abort();
  }, []);

  const setLocale = useCallback(async (next: string) => {
    const localeNext = next || PAGE_LANGUAGE;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const seq = ++seqRef.current;
    setLoading(true);

    const cached = localeNext === PAGE_LANGUAGE ? null : readSessionCatalog(localeNext);
    if (cached) {
      setMessages({ ...EN_MESSAGES, ...cached.messages });
      setCatalogVersion(cached.version);
      setLocaleState(localeNext);
      persistLocale(localeNext);
      applyDocumentLocale(localeNext);
    }

    try {
      const dict = await fetchCatalog(localeNext, ac.signal);
      if (seq !== seqRef.current) return;
      setMessages(dict.messages);
      setCatalogVersion(dict.version);
      setLocaleState(localeNext);
      persistLocale(localeNext);
      applyDocumentLocale(localeNext);
    } catch {
      if (seq !== seqRef.current) return;
      if (!cached) {
        setMessages({ ...EN_MESSAGES });
        setLocaleState(localeNext);
        persistLocale(localeNext);
        applyDocumentLocale(localeNext);
      }
    } finally {
      if (seq === seqRef.current) {
        setLoading(false);
        setReady(true);
      }
    }
  }, []);

  const t = useCallback(
    (key: MessageKey | string, fallback?: string) => {
      const hit = messages[key];
      if (hit !== undefined && hit !== null) return hit;
      return fallback || EN_MESSAGES[key as MessageKey] || key;
    },
    [messages]
  );

  const value = useMemo(
    () => ({ locale, messages, ready, loading, catalogVersion, t, setLocale }),
    [locale, messages, ready, loading, catalogVersion, t, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}

/** Safe outside provider during SSR/tests — returns English identity. */
export function useT() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return (key: MessageKey | string, fallback?: string) => {
      const en = EN_MESSAGES[key as MessageKey];
      if (fallback !== undefined) return fallback;
      if (en !== undefined) return en;
      return key;
    };
  }
  return ctx.t;
}

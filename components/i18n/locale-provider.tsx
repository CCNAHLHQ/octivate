"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  t: (key: MessageKey | string, fallback?: string) => string;
  setLocale: (locale: string) => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

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

async function fetchCatalog(locale: string): Promise<MessageDict> {
  if (locale === PAGE_LANGUAGE) return { ...EN_MESSAGES };
  const res = await fetch(`/api/i18n/catalog?locale=${encodeURIComponent(locale)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load catalog");
  const data = (await res.json()) as { messages?: MessageDict };
  return { ...EN_MESSAGES, ...(data.messages || {}) };
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(PAGE_LANGUAGE);
  const [messages, setMessages] = useState<MessageDict>({ ...EN_MESSAGES });
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = readStoredLocale();
    setLocaleState(stored);
    applyDocumentLocale(stored);
    if (stored === PAGE_LANGUAGE) {
      setMessages({ ...EN_MESSAGES });
      setReady(true);
      return;
    }
    setLoading(true);
    void fetchCatalog(stored)
      .then((dict) => {
        setMessages(dict);
        persistLocale(stored);
      })
      .catch(() => {
        setMessages({ ...EN_MESSAGES });
      })
      .finally(() => {
        setLoading(false);
        setReady(true);
      });
  }, []);

  const setLocale = useCallback(async (next: string) => {
    const localeNext = next || PAGE_LANGUAGE;
    setLoading(true);
    try {
      const dict = await fetchCatalog(localeNext);
      setMessages(dict);
      setLocaleState(localeNext);
      persistLocale(localeNext);
      applyDocumentLocale(localeNext);
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, []);

  const t = useCallback(
    (key: MessageKey | string, fallback?: string) => {
      return messages[key] || fallback || EN_MESSAGES[key as MessageKey] || key;
    },
    [messages]
  );

  const value = useMemo(
    () => ({ locale, messages, ready, loading, t, setLocale }),
    [locale, messages, ready, loading, t, setLocale]
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
    return (key: MessageKey | string, fallback?: string) =>
      fallback || EN_MESSAGES[key as MessageKey] || key;
  }
  return ctx.t;
}

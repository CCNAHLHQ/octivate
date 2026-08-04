import { PAGE_LANGUAGE, TRANSLATE_STORAGE_KEY } from "@/lib/i18n/languages";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate?: {
        TranslateElement: new (
          options: { pageLanguage: string; autoDisplay: boolean },
          id: string
        ) => void;
      };
    };
  }
}

const SCRIPT_ID = "octivate-google-translate";
const HOST_ID = "octivate-google-translate-host";
const ELEMENT_ID = "octivate-google-translate-el";

export function readStoredLanguage(): string {
  if (typeof window === "undefined") return PAGE_LANGUAGE;
  try {
    const stored = localStorage.getItem(TRANSLATE_STORAGE_KEY);
    if (stored) return stored;
  } catch {
    /* ignore */
  }
  const match = document.cookie.match(/(?:^|; )googtrans=([^;]+)/);
  if (!match) return PAGE_LANGUAGE;
  const value = decodeURIComponent(match[1]);
  const parts = value.split("/").filter(Boolean);
  return parts[parts.length - 1] || PAGE_LANGUAGE;
}

function writeCookie(name: string, value: string) {
  const domain = window.location.hostname.replace(/^www\./, "");
  const maxAge = 60 * 60 * 24 * 365;
  const base = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`;
  document.cookie = base;
  if (domain.includes(".")) {
    document.cookie = `${base};domain=.${domain}`;
  }
}

export function setTranslateCookie(lang: string) {
  if (lang === PAGE_LANGUAGE) {
    writeCookie("googtrans", "");
    // Expire leftovers
    document.cookie = "googtrans=;path=/;max-age=0;SameSite=Lax";
    const domain = window.location.hostname.replace(/^www\./, "");
    if (domain.includes(".")) {
      document.cookie = `googtrans=;path=/;max-age=0;domain=.${domain};SameSite=Lax`;
    }
    try {
      localStorage.removeItem(TRANSLATE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return;
  }

  writeCookie("googtrans", `/auto/${lang}`);
  try {
    localStorage.setItem(TRANSLATE_STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

export function ensureTranslateHost() {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.className = "notranslate";
    host.setAttribute("aria-hidden", "true");
    host.setAttribute("translate", "no");
    host.style.cssText = "display:none!important;visibility:hidden;height:0;overflow:hidden;";
    document.body.appendChild(host);
  }
  return host;
}

function mountElement() {
  const host = ensureTranslateHost();
  if (!document.getElementById(ELEMENT_ID)) {
    host.innerHTML = `<div id="${ELEMENT_ID}"></div>`;
  }
  if (!window.google?.translate?.TranslateElement) return;
  // Recreate cleanly so cookie-driven language applies after navigation.
  host.innerHTML = `<div id="${ELEMENT_ID}"></div>`;
  // eslint-disable-next-line no-new
  new window.google.translate.TranslateElement(
    { pageLanguage: PAGE_LANGUAGE, autoDisplay: false },
    ELEMENT_ID
  );
}

/** Keep googtrans cookie aligned with localStorage so language survives navigation. */
export function syncTranslatePreference() {
  if (typeof window === "undefined") return;
  let stored = "";
  try {
    stored = localStorage.getItem(TRANSLATE_STORAGE_KEY) || "";
  } catch {
    stored = "";
  }
  if (!stored) return;
  const match = document.cookie.match(/(?:^|; )googtrans=([^;]+)/);
  const cookieLang = match
    ? decodeURIComponent(match[1]).split("/").filter(Boolean).pop()
    : "";
  if (cookieLang !== stored) setTranslateCookie(stored);
}

export function loadGoogleTranslate(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  syncTranslatePreference();
  ensureTranslateHost();

  if (window.google?.translate?.TranslateElement) {
    mountElement();
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const finish = () => {
      try {
        mountElement();
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.google?.translate?.TranslateElement) {
        finish();
        return;
      }
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Translate script failed")),
        { once: true }
      );
      return;
    }

    window.googleTranslateElementInit = finish;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src =
      "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    script.onerror = () => reject(new Error("Translate script failed"));
    document.body.appendChild(script);
  });
}

export function applyLanguage(lang: string) {
  setTranslateCookie(lang);
  window.location.reload();
}

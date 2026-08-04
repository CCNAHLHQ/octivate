"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Languages, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE_LANGUAGE, TRANSLATE_LANGUAGES } from "@/lib/i18n/languages";
import { useLocale } from "@/components/i18n/locale-provider";
import { useMounted } from "@/lib/use-mounted";

/**
 * Global language control — loads server-cached catalogs (auto-filled via OpenRouter).
 */
export function SiteTranslate({ className }: { className?: string }) {
  const mounted = useMounted();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { locale, loading, setLocale, t } = useLocale();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const currentLabel =
    TRANSLATE_LANGUAGES.find((l) => l.value === locale)?.label || "English";

  return (
    <div
      ref={rootRef}
      className={cn("site-translate notranslate", className)}
      translate="no"
    >
      <button
        type="button"
        className={cn("site-translate-btn", open && "is-open")}
        aria-label={`${t("nav.translate")} — ${currentLabel}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t("nav.translate")}
        disabled={!mounted || loading}
        onClick={() => setOpen((v) => !v)}
      >
        {loading ? (
          <Loader2 className="site-translate-ico animate-spin" aria-hidden strokeWidth={2.1} />
        ) : (
          <Languages className="site-translate-ico" aria-hidden strokeWidth={2.1} />
        )}
      </button>

      {open ? (
        <div className="site-translate-menu" role="listbox" aria-label={t("nav.translate")}>
          <p className="site-translate-menu-label">{t("nav.translate")}</p>
          {TRANSLATE_LANGUAGES.map((item) => {
            const active = item.value === locale;
            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={active}
                className={cn("site-translate-option", active && "is-active")}
                disabled={loading}
                onClick={() => {
                  if (item.value === locale) {
                    setOpen(false);
                    return;
                  }
                  setOpen(false);
                  void setLocale(item.value);
                }}
              >
                {item.flag ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="site-translate-flag"
                    src={`https://flagcdn.com/w20/${item.flag}.png`}
                    alt=""
                    width={16}
                    height={12}
                    loading="lazy"
                  />
                ) : (
                  <span className="site-translate-flag is-empty" />
                )}
                <span>{item.label}</span>
                {active ? <Check className="site-translate-check" aria-hidden /> : null}
              </button>
            );
          })}
          {locale !== PAGE_LANGUAGE ? (
            <p className="site-translate-hint">Cached on server · Octivate i18n</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

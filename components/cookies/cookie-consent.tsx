"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COOKIE_SETTINGS_EVENT,
  hasAnswered,
  isPublicCookieRoute,
  setConsent,
} from "@/lib/cookies/consent";
import { CookieSettingsModal } from "@/components/cookies/cookie-settings-modal";
import { useT } from "@/components/i18n/locale-provider";

export function CookieConsent() {
  const t = useT();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [showPill, setShowPill] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const publicRoute = isPublicCookieRoute(pathname);

  useEffect(() => {
    setReady(true);
    if (!publicRoute) {
      setShowPill(false);
      return;
    }
    setShowPill(!hasAnswered());
  }, [publicRoute, pathname]);

  useEffect(() => {
    if (!publicRoute) return;
    if (searchParams?.get("cookies") === "1") {
      setSettingsOpen(true);
    }
  }, [publicRoute, searchParams]);

  useEffect(() => {
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail as { type?: string } | undefined;
      if (detail?.type === "open") setSettingsOpen(true);
    };
    window.addEventListener(COOKIE_SETTINGS_EVENT, onEvent);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, onEvent);
  }, []);

  if (!ready || !publicRoute) return null;

  function acceptAll() {
    setConsent({ analytics: true, marketing: true });
    setShowPill(false);
    setSettingsOpen(false);
  }

  return (
    <>
      <div
        className={cn("ck-pill", showPill && !settingsOpen && "is-visible")}
        role="dialog"
        aria-label={t("cookie.pillLabel")}
      >
        <span className="ck-pill-label">{t("cookie.pillLabel")}</span>
        <div className="ck-pill-actions">
          <button
            type="button"
            className="ck-pill-btn is-gear"
            aria-label={t("cookie.settingsTitle")}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="ck-pill-btn is-accept"
            aria-label={t("cookie.acceptAll")}
            onClick={acceptAll}
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <CookieSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => {
          setShowPill(false);
        }}
      />
    </>
  );
}

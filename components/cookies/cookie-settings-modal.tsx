"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  defaultConsent,
  getConsent,
  setConsent,
  type CookieConsent,
} from "@/lib/cookies/consent";
import { useT } from "@/components/i18n/locale-provider";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: (value: CookieConsent) => void;
};

export function CookieSettingsModal({ open, onClose, onSaved }: Props) {
  const t = useT();
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const current = getConsent() ?? defaultConsent();
    setAnalytics(current.analytics);
    setMarketing(current.marketing);
    const id = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  function save() {
    const value = setConsent({ analytics, marketing });
    onSaved?.(value);
    onClose();
  }

  return createPortal(
    <div className={cn("ck-modal-root", visible && "is-open")} role="presentation">
      <button
        type="button"
        className="ck-modal-backdrop"
        aria-label={t("cookie.close")}
        onClick={onClose}
      />
      <div
        className="ck-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="ck-modal-head">
          <h2 id={titleId}>{t("cookie.settingsTitle")}</h2>
          <button
            type="button"
            className="ck-modal-close"
            onClick={onClose}
            aria-label={t("cookie.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="ck-modal-rows">
          <div className="ck-row">
            <div className="ck-row-copy">
              <span className="ck-row-label">{t("cookie.essential")}</span>
              <span className="ck-row-hint">{t("cookie.essentialHint")}</span>
            </div>
            <span className="ck-always">{t("cookie.alwaysOn")}</span>
          </div>

          <div className="ck-row">
            <div className="ck-row-copy">
              <span className="ck-row-label">{t("cookie.analytics")}</span>
              <span className="ck-row-hint">{t("cookie.analyticsHint")}</span>
            </div>
            <button
              type="button"
              className={cn("ck-toggle", analytics && "is-on")}
              aria-pressed={analytics}
              aria-label={t("cookie.analytics")}
              onClick={() => setAnalytics((v) => !v)}
            >
              <span className="ck-toggle-knob" />
            </button>
          </div>

          <div className="ck-row">
            <div className="ck-row-copy">
              <span className="ck-row-label">{t("cookie.marketing")}</span>
              <span className="ck-row-hint">{t("cookie.marketingHint")}</span>
            </div>
            <button
              type="button"
              className={cn("ck-toggle", marketing && "is-on")}
              aria-pressed={marketing}
              aria-label={t("cookie.marketing")}
              onClick={() => setMarketing((v) => !v)}
            >
              <span className="ck-toggle-knob" />
            </button>
          </div>
        </div>

        <div className="ck-modal-foot">
          <Link href="/cookies" className="ck-statement" onClick={onClose}>
            {t("cookie.statement")}
          </Link>
          <button type="button" className="ck-save" onClick={save}>
            {t("cookie.save")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

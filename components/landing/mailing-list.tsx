"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  MailingListCopy,
  MailingListForm,
  MAILING_SUBSCRIBED_KEY,
} from "@/components/landing/mailing-list-section";
import { useMounted } from "@/lib/use-mounted";

export const MAILING_DISMISS_KEY = "octivate-mail-dismissed-at";
/** Re-prompt after 7 days if dismissed without subscribing. */
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
/** Short settle so first paint completes — not a noticeable “wait”. */
const AUTO_OPEN_MS = 420;

function shouldAutoPrompt(): boolean {
  try {
    if (localStorage.getItem(MAILING_SUBSCRIBED_KEY) === "1") return false;
    const dismissedAt = Number(localStorage.getItem(MAILING_DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return false;
  } catch {
    /* ignore storage errors */
  }
  return true;
}

/**
 * Landing mailing modal — fades in shortly after load (seamless, no long delay).
 * Also opens from `octivate:open-mailing-list` CTAs.
 */
export function MailingListModal({ autoOpen = false }: { autoOpen?: boolean }) {
  const mounted = useMounted();
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  const close = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => setOpen(false), 280);
    try {
      localStorage.setItem(MAILING_DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }, []);

  const openModal = useCallback(() => {
    setOpen(true);
  }, []);

  useEffect(() => {
    const onOpen = () => openModal();
    window.addEventListener("octivate:open-mailing-list", onOpen);
    return () => window.removeEventListener("octivate:open-mailing-list", onOpen);
  }, [openModal]);

  useEffect(() => {
    if (!autoOpen || !mounted) return;
    if (!shouldAutoPrompt()) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 0 : AUTO_OPEN_MS;
    const t = window.setTimeout(() => openModal(), delay);
    return () => window.clearTimeout(t);
  }, [autoOpen, mounted, openModal]);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);

    // Two frames: mount at opacity 0, then fade in.
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => setVisible(true));
    });
    const focusT = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLInputElement>("input[type=email]")?.focus();
    }, 320);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      window.clearTimeout(focusT);
    };
  }, [open, close]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={`mailing-modal-root${visible ? " is-visible" : ""}`}
      role="presentation"
    >
      <button
        type="button"
        className="mailing-modal-backdrop"
        aria-label="Close mailing list"
        onClick={close}
      />
      <div
        ref={panelRef}
        className="mailing-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="mailing-glow" aria-hidden="true" />
        <button type="button" className="mailing-modal-close" aria-label="Close" onClick={close}>
          <X className="h-4 w-4" />
        </button>
        <div className="mailing-modal-grid">
          <MailingListCopy titleId={titleId} descId={descId} />
          <MailingListForm idPrefix="mailing-modal" />
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Scroll to inline section, or open modal if not on landing. */
export function openMailingListModal() {
  if (typeof window === "undefined") return;

  const inline = document.getElementById("mailing");
  if (inline) {
    inline.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      inline.querySelector<HTMLInputElement>("input[type=email]")?.focus();
    }, 400);
    return;
  }

  try {
    if (localStorage.getItem(MAILING_SUBSCRIBED_KEY) === "1") return;
  } catch {
    /* ignore */
  }

  window.dispatchEvent(new Event("octivate:open-mailing-list"));
}

export { MailingListSection } from "@/components/landing/mailing-list-section";

"use client";

import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IntroStepArt } from "@/components/onboarding/intro-step-art";
import { TourSpotlight } from "@/components/onboarding/tour-spotlight";
import { useT } from "@/components/i18n/locale-provider";
import { WORKSPACE_TOUR_SIDEBAR_EVENT } from "@/lib/onboarding/content";
import {
  OPERATOR_INTRO_EVENT,
  OPERATOR_INTRO_STEPS,
  OPERATOR_INTRO_STORAGE_KEY,
} from "@/lib/onboarding/operator-content";
import { cn } from "@/lib/utils";

type Persist = { seen?: boolean; completed?: boolean };
type Session = { open: boolean; step: number };

const SESSION_KEY = `${OPERATOR_INTRO_STORAGE_KEY}:session`;

function readPersist(): Persist {
  try {
    const raw = localStorage.getItem(OPERATOR_INTRO_STORAGE_KEY);
    if (!raw) return {};
    if (raw === "done") return { seen: true, completed: true };
    return JSON.parse(raw) as Persist;
  } catch {
    return {};
  }
}

function writePersist(next: Persist) {
  try {
    localStorage.setItem(OPERATOR_INTRO_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.open) return null;
    return {
      open: true,
      step: Math.max(0, Math.min(OPERATOR_INTRO_STEPS.length - 1, Number(parsed.step) || 0)),
    };
  } catch {
    return null;
  }
}

function writeSession(next: Session) {
  try {
    if (!next.open) {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function hashOf(route?: string) {
  if (!route) return "#pulse";
  const i = route.indexOf("#");
  return i >= 0 ? route.slice(i) : "#pulse";
}

export function OperatorIntroModal() {
  const t = useT();
  const titleId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [navReady, setNavReady] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const total = OPERATOR_INTRO_STEPS.length;
  const current = OPERATOR_INTRO_STEPS[step];
  const isLast = step === total - 1;
  const Icon = current?.icon;
  const onOperator = pathname.startsWith("/dashboard/operator");

  const close = useCallback((complete = false) => {
    if (complete) writePersist({ seen: true, completed: true });
    writeSession({ open: false, step: 0 });
    setOpen(false);
    setStep(0);
    setNavReady(false);
  }, []);

  const openModal = useCallback(() => {
    setStep(0);
    setNavReady(false);
    setOpen(true);
    writeSession({ open: true, step: 0 });
  }, []);

  const goStep = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      setNavReady(false);
      startTransition(() => setStep(clamped));
      writeSession({ open: true, step: clamped });
    },
    [total]
  );

  useEffect(() => {
    if (!onOperator) {
      setOpen(false);
      setHydrated(true);
      return;
    }
    const session = readSession();
    if (session?.open) {
      setOpen(true);
      setStep(session.step);
    }
    setHydrated(true);
  }, [onOperator]);

  useEffect(() => {
    if (!hydrated || !onOperator) return;
    if (readPersist().seen) return;
    if (readSession()?.open) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => openModal(), reduced ? 120 : 320);
    return () => window.clearTimeout(t);
  }, [hydrated, onOperator, openModal]);

  useEffect(() => {
    if (open) {
      writePersist({ ...readPersist(), seen: true });
      writeSession({ open: true, step });
    }
  }, [open, step]);

  useEffect(() => {
    const onOpen = () => {
      if (pathname.startsWith("/dashboard/operator")) openModal();
    };
    window.addEventListener(OPERATOR_INTRO_EVENT, onOpen);
    return () => window.removeEventListener(OPERATOR_INTRO_EVENT, onOpen);
  }, [openModal, pathname]);

  useEffect(() => {
    if (!open || !current || !onOperator) return;
    let cancelled = false;
    let failSafe = 0;

    if (current.requireSidebar) {
      window.dispatchEvent(new CustomEvent(WORKSPACE_TOUR_SIDEBAR_EVENT));
    }

    const targetHash = hashOf(current.route);
    const currentHash = window.location.hash || "#pulse";

    const markReady = () => {
      if (!cancelled) setNavReady(true);
    };

    if (currentHash === targetHash) {
      markReady();
      return () => {
        cancelled = true;
      };
    }

    setNavReady(false);
    failSafe = window.setTimeout(markReady, 900);
    router.push(`/dashboard/operator${targetHash}`);

    const onHash = () => {
      if ((window.location.hash || "#pulse") === targetHash) markReady();
    };
    window.addEventListener("hashchange", onHash);

    return () => {
      cancelled = true;
      window.clearTimeout(failSafe);
      window.removeEventListener("hashchange", onHash);
    };
  }, [open, current, onOperator, router]);

  useEffect(() => {
    if (!open) {
      try {
        delete document.documentElement.dataset.workspaceTour;
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      document.documentElement.dataset.workspaceTour = "1";
    } catch {
      /* ignore */
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "ArrowRight" && step < total - 1) goStep(step + 1);
      if (e.key === "ArrowLeft" && step > 0) goStep(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, step, total, goStep]);

  const spotlightReady = useMemo(() => {
    if (!open || !current || !navReady) return false;
    return pathname.startsWith("/dashboard/operator");
  }, [open, current, navReady, pathname]);

  if (!open || !current || !onOperator) return null;

  return (
    <div className="intro-modal-root is-tour" role="presentation">
      <button
        type="button"
        className="intro-modal-backdrop is-dim"
        aria-label={t("onboard.ui.closeTour")}
        onClick={() => close(false)}
      />
      <TourSpotlight
        target={current.target}
        pulse={current.demo === "pulse"}
        ready={spotlightReady}
      />
      <div
        className="intro-modal-panel is-docked is-compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="intro-modal-head">
          <p className="intro-modal-eyebrow">{t("onboard.ui.operatorTour")}</p>
          <div className="intro-modal-head-meta">
            <p className="intro-modal-step-count">
              {t("onboard.ui.stepOf")
                .replace("{n}", String(step + 1))
                .replace("{total}", String(total))}
            </p>
            <button
              type="button"
              className="intro-modal-close"
              aria-label={t("onboard.ui.closeTour")}
              onClick={() => close(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="intro-modal-progress" aria-hidden>
          {OPERATOR_INTRO_STEPS.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "intro-progress-dot",
                i <= step && "is-active",
                i === step && "is-current"
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            className="intro-modal-body is-compact"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <IntroStepArt kind={current.art} accent={current.accent} />
            <div className={cn("intro-modal-kicker-row", current.accent && `is-${current.accent}`)}>
              {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
              <p className="intro-modal-kicker">{current.kicker}</p>
            </div>
            <h2 id={titleId} className="intro-modal-title">
              {current.title}
              {current.titleAccent ? (
                <>
                  {" "}
                  <span className="intro-modal-title-accent">{current.titleAccent}</span>
                </>
              ) : null}
            </h2>
            {current.tagline ? <p className="intro-modal-tagline">{current.tagline}</p> : null}
            <p className="intro-modal-desc">{current.description}</p>
            {current.bullets.length ? (
              <ul className="intro-modal-bullets">
                {current.bullets.map((b) => (
                  <li key={`${b.lead || ""}-${b.text}`}>
                    {b.lead ? <strong>{b.lead}</strong> : null}
                    {b.lead ? " " : null}
                    {b.text}
                  </li>
                ))}
              </ul>
            ) : null}
          </motion.div>
        </AnimatePresence>

        <div className="intro-modal-actions">
          <button type="button" className="intro-modal-skip" onClick={() => close(true)}>
            {t("onboard.ui.skip")}
          </button>
          <div className="intro-modal-nav">
            {step > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => goStep(step - 1)}>
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("onboard.ui.back")}
              </Button>
            ) : null}
            {!isLast ? (
              <Button size="sm" onClick={() => goStep(step + 1)}>
                {t("onboard.ui.next")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => close(true)}>
                <Check className="h-3.5 w-3.5" />
                {t("onboard.ui.getStarted")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function openOperatorIntro() {
  writeSession({ open: true, step: 0 });
  window.dispatchEvent(new CustomEvent(OPERATOR_INTRO_EVENT));
}

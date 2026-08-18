"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IntroStepArt } from "@/components/onboarding/intro-step-art";
import { TourSpotlight } from "@/components/onboarding/tour-spotlight";
import { useT } from "@/components/i18n/locale-provider";
import {
  WORKSPACE_INTRO_EVENT,
  WORKSPACE_INTRO_PREFETCH_ROUTES,
  WORKSPACE_INTRO_STEPS,
  WORKSPACE_TOUR_SIDEBAR_EVENT,
} from "@/lib/onboarding/content";
import {
  clearIntroSession,
  markIntroComplete,
  markIntroSeen,
  readIntroSession,
  shouldAutoShowIntro,
  writeIntroSession,
} from "@/lib/onboarding/storage";
import { apiFetch } from "@/lib/api-client";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Exact route rules — avoid `/dashboard` matching every dashboard child. */
function routeMatches(
  pathname: string,
  stepRoute?: string,
  resolveProject?: boolean,
  exact = false
) {
  if (!stepRoute) return true;
  if (resolveProject) {
    return pathname.startsWith("/dashboard/projects/") && pathname !== "/dashboard/projects";
  }
  if (exact || stepRoute === "/dashboard") {
    return pathname === stepRoute;
  }
  if (stepRoute === "/dashboard/projects") {
    return pathname === "/dashboard/projects";
  }
  return pathname === stepRoute || pathname.startsWith(`${stepRoute}/`);
}

function setTourOpenFlag(open: boolean) {
  try {
    if (open) document.documentElement.dataset.workspaceTour = "1";
    else delete document.documentElement.dataset.workspaceTour;
  } catch {
    /* ignore */
  }
}

/** Retired workspace surfaces that hard-redirect — never push these from the tour. */
const RETIRED_TOUR_ROUTES = new Set(["/dashboard/monitors", "/dashboard/sources"]);

function isRetiredTourRoute(route?: string) {
  if (!route) return false;
  const base = route.split("#")[0] || route;
  return RETIRED_TOUR_ROUTES.has(base);
}

export function WorkspaceIntroModal() {
  const t = useT();
  const titleId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [navReady, setNavReady] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const autoOpenedRef = useRef(false);
  const navigatingRef = useRef(false);
  const lastNavKeyRef = useRef("");
  const projectCacheRef = useRef<{ at: number; projects: Project[] } | null>(null);

  const total = WORKSPACE_INTRO_STEPS.length;
  const current = WORKSPACE_INTRO_STEPS[step];
  const isLast = step === total - 1;
  const Icon = current?.icon;

  const close = useCallback((complete = false) => {
    if (complete) markIntroComplete();
    else clearIntroSession();
    writeIntroSession({ open: false, step: 0 });
    setTourOpenFlag(false);
    navigatingRef.current = false;
    lastNavKeyRef.current = "";
    setOpen(false);
    setStep(0);
    setNavReady(false);
  }, []);

  // Keep tour flag if session is still open (layout remounts must not re-enable map polling).
  useEffect(() => {
    return () => {
      if (readIntroSession()?.open) return;
      setTourOpenFlag(false);
    };
  }, []);

  const openModal = useCallback(() => {
    setStep(0);
    setNavReady(false);
    navigatingRef.current = false;
    lastNavKeyRef.current = "";
    setOpen(true);
    setTourOpenFlag(true);
    writeIntroSession({ open: true, step: 0 });
    for (const route of WORKSPACE_INTRO_PREFETCH_ROUTES) {
      try {
        router.prefetch(route);
      } catch {
        /* ignore */
      }
    }
  }, [router]);

  const goStep = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      // Drop ready only when leaving the current step — avoids flicker on same-step re-renders.
      setNavReady(false);
      navigatingRef.current = false;
      lastNavKeyRef.current = "";
      setStep(clamped);
      writeIntroSession({ open: true, step: clamped });
      const upcoming = WORKSPACE_INTRO_STEPS[clamped + 1];
      if (upcoming?.route) {
        try {
          router.prefetch(upcoming.route);
        } catch {
          /* ignore */
        }
      }
    },
    [router, total]
  );

  useEffect(() => {
    const session = readIntroSession();
    if (session?.open) {
      setOpen(true);
      setStep(session.step);
      setTourOpenFlag(true);
      for (const route of WORKSPACE_INTRO_PREFETCH_ROUTES) {
        try {
          router.prefetch(route);
        } catch {
          /* ignore */
        }
      }
    }
    setHydrated(true);
  }, [router]);

  // Auto-show once when never seen — only mark attempted after openModal actually runs.
  useEffect(() => {
    if (!hydrated) return;
    if (autoOpenedRef.current) return;
    if (pathname.startsWith("/dashboard/operator")) return;
    if (!shouldAutoShowIntro()) return;
    if (readIntroSession()?.open) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 120 : 280;
    const timer = window.setTimeout(() => {
      autoOpenedRef.current = true;
      openModal();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [hydrated, openModal, pathname]);

  useEffect(() => {
    if (open) {
      markIntroSeen();
      writeIntroSession({ open: true, step });
      setTourOpenFlag(true);
    }
  }, [open, step]);

  useEffect(() => {
    const onOpen = () => openModal();
    window.addEventListener(WORKSPACE_INTRO_EVENT, onOpen);
    return () => window.removeEventListener(WORKSPACE_INTRO_EVENT, onOpen);
  }, [openModal]);

  /**
   * Navigate only when the step's route is wrong. Pathname updates must not
   * re-push or clear readiness in a loop (that caused refresh/glitch feel).
   */
  useEffect(() => {
    if (!open || !current) return;
    let cancelled = false;
    let failSafe = 0;
    let readyRaf = 0;

    const exactList =
      current.target === "[data-tour='projects-new']" || current.route === "/dashboard";

    // resolveProject: list URL is NOT terminal — we still try to enter a theatre.
    const alreadyThere = current.resolveProject
      ? routeMatches(pathname, current.route, true, exactList)
      : routeMatches(pathname, current.route, false, exactList);

    const navKey = `${current.id}:${pathname}`;

    const markReady = () => {
      if (cancelled) return;
      navigatingRef.current = false;
      setNavReady(true);
    };

    const markReadySoon = () => {
      window.cancelAnimationFrame(readyRaf);
      readyRaf = window.requestAnimationFrame(() => {
        readyRaf = window.requestAnimationFrame(markReady);
      });
    };

    if (alreadyThere) {
      // Arrived (or already on route) — do not push again or drop readiness.
      lastNavKeyRef.current = navKey;
      navigatingRef.current = false;
      markReadySoon();
      return () => {
        cancelled = true;
        window.cancelAnimationFrame(readyRaf);
      };
    }

    // Still navigating toward this step — avoid duplicate pushes for the same step+path attempt.
    if (navigatingRef.current && lastNavKeyRef.current.startsWith(`${current.id}:`)) {
      failSafe = window.setTimeout(markReady, 1200);
      return () => {
        cancelled = true;
        window.clearTimeout(failSafe);
      };
    }

    lastNavKeyRef.current = navKey;
    navigatingRef.current = true;
    setNavReady(false);
    failSafe = window.setTimeout(markReady, 1200);

    if (current.requireSidebar) {
      window.dispatchEvent(new CustomEvent(WORKSPACE_TOUR_SIDEBAR_EVENT));
    }

    async function syncRoute() {
      if (isRetiredTourRoute(current.route)) {
        markReady();
        return;
      }

      if (current.resolveProject) {
        try {
          const now = Date.now();
          let projects = projectCacheRef.current?.projects;
          if (!projects || now - (projectCacheRef.current?.at || 0) > 8_000) {
            const res = await Promise.race([
              apiFetch<{ projects: Project[] }>("/api/projects"),
              new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 450)),
            ]);
            if (cancelled) return;
            if (res && Array.isArray(res.projects)) {
              projects = res.projects;
              projectCacheRef.current = { at: Date.now(), projects };
            } else {
              // Timeout / failed race — do not cache empty as truth.
              projects = projectCacheRef.current?.projects;
            }
            if (!projects) projects = [];
          }
          if (cancelled) return;
          const active =
            projects.find((p) => p.status !== "archived") || projects[0];
          if (active) {
            const href = `/dashboard/projects/${active.id}`;
            if (!routeMatches(pathname, href, true)) {
              router.push(href);
            }
            return;
          }
        } catch {
          /* fall through */
        }
        if (cancelled) return;
        if (pathname !== "/dashboard/projects") {
          router.push("/dashboard/projects");
        }
        return;
      }

      if (
        current.route &&
        !isRetiredTourRoute(current.route) &&
        !routeMatches(pathname, current.route, false, exactList)
      ) {
        router.push(current.route);
      }
    }

    void syncRoute();
    return () => {
      cancelled = true;
      window.clearTimeout(failSafe);
      window.cancelAnimationFrame(readyRaf);
    };
  }, [open, current, pathname, router]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overscrollBehavior = prevOverscroll;
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
    if (!open || !current) return false;
    if (!navReady) return false;
    if (current.resolveProject) {
      return (
        routeMatches(pathname, current.route, true) || pathname === "/dashboard/projects"
      );
    }
    if (current.target === "[data-tour='projects-new']") {
      return pathname === "/dashboard/projects";
    }
    if (current.route === "/dashboard") {
      return pathname === "/dashboard";
    }
    return routeMatches(pathname, current.route, false, true);
  }, [open, current, navReady, pathname]);

  const fallbackTarget =
    current?.resolveProject && /^\/dashboard\/projects\/[^/]+/.test(pathname)
      ? "[data-tour='project-question']"
      : current?.resolveProject && pathname === "/dashboard/projects"
        ? "[data-tour='projects-new']"
        : current?.target;

  if (!open || !current) return null;

  return (
    <div className="intro-modal-root is-tour" role="presentation">
      <button
        type="button"
        className="intro-modal-backdrop is-dim"
        aria-label={t("onboard.ui.closeTour")}
        onClick={() => close(false)}
      />

      <TourSpotlight
        target={fallbackTarget}
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
          <p className="intro-modal-eyebrow">{t("onboard.ui.workspaceTour")}</p>
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
          {WORKSPACE_INTRO_STEPS.map((s, i) => (
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
              {Icon && <Icon className="h-4 w-4" aria-hidden />}
              <p className="intro-modal-kicker">{current.kicker}</p>
            </div>
            <h2 id={titleId} className="intro-modal-title">
              {current.title}
              {current.titleAccent && (
                <>
                  {" "}
                  <span className="intro-modal-title-accent">{current.titleAccent}</span>
                </>
              )}
            </h2>
            {current.tagline && <p className="intro-modal-tagline">{current.tagline}</p>}
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
            {step > 0 && (
              <Button size="sm" variant="ghost" onClick={() => goStep(step - 1)}>
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("onboard.ui.back")}
              </Button>
            )}
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

export function openWorkspaceIntro() {
  writeIntroSession({ open: true, step: 0 });
  window.dispatchEvent(new CustomEvent(WORKSPACE_INTRO_EVENT));
}

"use client";

import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IntroStepArt } from "@/components/onboarding/intro-step-art";
import { TourSpotlight } from "@/components/onboarding/tour-spotlight";
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

export function WorkspaceIntroModal() {
  const titleId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [navReady, setNavReady] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const total = WORKSPACE_INTRO_STEPS.length;
  const current = WORKSPACE_INTRO_STEPS[step];
  const isLast = step === total - 1;
  const Icon = current?.icon;

  const close = useCallback((complete = false) => {
    if (complete) markIntroComplete();
    else clearIntroSession();
    writeIntroSession({ open: false, step: 0 });
    setOpen(false);
    setStep(0);
    setNavReady(false);
  }, []);

  const openModal = useCallback(() => {
    setStep(0);
    setNavReady(false);
    setOpen(true);
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
      setNavReady(false);
      startTransition(() => setStep(clamped));
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

  useEffect(() => {
    if (!hydrated) return;
    if (pathname.startsWith("/dashboard/operator")) return;
    if (!shouldAutoShowIntro()) return;
    if (readIntroSession()?.open) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 120 : 280;
    const t = window.setTimeout(() => {
      openModal();
    }, delay);
    return () => window.clearTimeout(t);
  }, [hydrated, openModal, pathname]);

  useEffect(() => {
    if (open) {
      markIntroSeen();
      writeIntroSession({ open: true, step });
    }
  }, [open, step]);

  useEffect(() => {
    const onOpen = () => openModal();
    window.addEventListener(WORKSPACE_INTRO_EVENT, onOpen);
    return () => window.removeEventListener(WORKSPACE_INTRO_EVENT, onOpen);
  }, [openModal]);

  useEffect(() => {
    if (!open || !current) return;
    let cancelled = false;
    let readyTimer = 0;
    let failSafe = 0;

    const markReadySoon = () => {
      window.clearTimeout(failSafe);
      window.cancelAnimationFrame(readyTimer);
      readyTimer = window.requestAnimationFrame(() => {
        readyTimer = window.requestAnimationFrame(() => {
          if (!cancelled) setNavReady(true);
        });
      });
    };

    const pushRoute = (href: string) => {
      startTransition(() => {
        router.push(href);
      });
    };

    async function syncRoute() {
      setNavReady(false);
      // Never leave the coachmark waiting on a stuck navigation.
      failSafe = window.setTimeout(() => {
        if (!cancelled) setNavReady(true);
      }, 900);

      if (current.requireSidebar) {
        window.dispatchEvent(new CustomEvent(WORKSPACE_TOUR_SIDEBAR_EVENT));
      }

      const exactList =
        current.target === "[data-tour='projects-new']" || current.route === "/dashboard";

      if (current.resolveProject) {
        try {
          const res = await Promise.race([
            apiFetch<{ projects: Project[] }>("/api/projects"),
            new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 450)),
          ]);
          if (cancelled) return;
          const projects = res?.projects || [];
          const active =
            projects.find((p) => p.status !== "archived") || projects[0];
          if (active) {
            // Prefer an existing project theatre for the run step.
            if (!routeMatches(pathname, `/dashboard/projects/${active.id}`, true)) {
              pushRoute(`/dashboard/projects/${active.id}`);
              return;
            }
            markReadySoon();
            return;
          }
        } catch {
          /* fall through — spotlight Start a new project */
        }

        if (cancelled) return;
        // No project yet: stay on Projects and highlight Start a new project.
        if (pathname === "/dashboard/projects") {
          markReadySoon();
          return;
        }
        pushRoute("/dashboard/projects");
        return;
      }

      if (current.route && !routeMatches(pathname, current.route, false, exactList)) {
        pushRoute(current.route);
        return;
      }

      markReadySoon();
    }

    void syncRoute();
    return () => {
      cancelled = true;
      window.clearTimeout(failSafe);
      window.cancelAnimationFrame(readyTimer);
    };
  }, [open, current, pathname, router]);

  useEffect(() => {
    if (!open || !current) return;
    const exactList =
      current.target === "[data-tour='projects-new']" || current.route === "/dashboard";
    const onProjectListFallback =
      Boolean(current.resolveProject) && pathname === "/dashboard/projects";
    if (
      routeMatches(pathname, current.route, current.resolveProject, exactList) ||
      onProjectListFallback
    ) {
      const t = window.requestAnimationFrame(() => setNavReady(true));
      return () => window.cancelAnimationFrame(t);
    }
  }, [open, current, pathname]);

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
        aria-label="Close tour"
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
          <p className="intro-modal-eyebrow">Workspace tour</p>
          <div className="intro-modal-head-meta">
            <p className="intro-modal-step-count">
              Step {step + 1} <span className="intro-modal-step-of">of {total}</span>
            </p>
            <button
              type="button"
              className="intro-modal-close"
              aria-label="Close"
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
            Skip tour
          </button>
          <div className="intro-modal-nav">
            {step > 0 && (
              <Button size="sm" variant="ghost" onClick={() => goStep(step - 1)}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
            {!isLast ? (
              <Button size="sm" onClick={() => goStep(step + 1)}>
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => close(true)}>
                <Check className="h-3.5 w-3.5" />
                Get started
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

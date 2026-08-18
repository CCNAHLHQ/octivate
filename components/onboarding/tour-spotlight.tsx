"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Rect = { top: number; left: number; width: number; height: number };

function sameRect(a: Rect | null, b: Rect | null) {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

/**
 * Highlight a tour target without scrolling or thrashing on DOM mutations.
 * Previous MutationObserver(attributes:true) on document.body caused spotlight
 * flicker whenever React updated any attribute during route transitions.
 */
export function TourSpotlight({
  target,
  pulse,
  ready = true,
}: {
  target?: string;
  pulse?: boolean;
  /** Wait until route/sidebar are ready before measuring. */
  ready?: boolean;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const rectRef = useRef<Rect | null>(null);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!target || !ready) {
      rectRef.current = null;
      setRect(null);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 24;
    let raf = 0;
    let timer = 0;
    let debounceRaf = 0;
    let observedEl: Element | null = null;
    let resizeObs: ResizeObserver | null = null;
    const observer = new MutationObserver(() => scheduleMeasure());

    const commit = (next: Rect | null) => {
      if (cancelled) return;
      if (sameRect(rectRef.current, next)) return;
      rectRef.current = next;
      setRect(next);
    };

    const observeTarget = () => {
      const el = document.querySelector(target!);
      if (!el) return;
      observer.disconnect();
      observer.observe(el, {
        attributes: true,
        attributeFilter: ["class", "style", "hidden", "aria-hidden", "aria-expanded"],
      });
      const shell = el.closest(".dash-shell, .dash-aside, .dash-main");
      if (shell) {
        observer.observe(shell, {
          attributes: true,
          attributeFilter: ["class", "data-mobile-open", "style"],
        });
      }
    };

    function measure() {
      if (cancelled) return false;
      const el = document.querySelector(target!) as HTMLElement | null;
      if (!el || el.getClientRects().length === 0) {
        commit(null);
        return false;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) {
        commit(null);
        return false;
      }

      if (observedEl !== el) {
        resizeObs?.disconnect();
        observedEl = el;
        if (typeof ResizeObserver !== "undefined") {
          resizeObs = new ResizeObserver(() => scheduleMeasure());
          resizeObs.observe(el);
        }
        observeTarget();
      }

      commit({
        top: r.top - 8,
        left: r.left - 8,
        width: r.width + 16,
        height: r.height + 16,
      });
      return true;
    }

    function scheduleMeasure() {
      if (cancelled) return;
      window.cancelAnimationFrame(debounceRaf);
      debounceRaf = window.requestAnimationFrame(() => {
        measure();
      });
    }

    function tick() {
      if (cancelled) return;
      attempts += 1;
      if (measure()) return;
      if (attempts >= maxAttempts) return;
      if (attempts < 8) {
        raf = window.requestAnimationFrame(tick);
      } else {
        timer = window.setTimeout(tick, 32);
      }
    }

    raf = window.requestAnimationFrame(tick);

    const onViewport = () => scheduleMeasure();
    window.addEventListener("resize", onViewport);
    window.addEventListener("scroll", onViewport, true);
    observeTarget();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.cancelAnimationFrame(debounceRaf);
      window.clearTimeout(timer);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("scroll", onViewport, true);
      observer.disconnect();
      resizeObs?.disconnect();
    };
  }, [target, ready]);

  if (!rect) return null;

  return (
    <motion.div
      className={cn("tour-spotlight", pulse && !reduced && "is-pulse")}
      initial={reduced ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.12 }}
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
      aria-hidden
    />
  );
}

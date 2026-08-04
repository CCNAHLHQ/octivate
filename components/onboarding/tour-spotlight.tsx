"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Rect = { top: number; left: number; width: number; height: number };

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
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!target || !ready) {
      setRect(null);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 36;
    let raf = 0;
    let timer = 0;

    function measure() {
      if (cancelled) return false;
      const el = document.querySelector(target!) as HTMLElement | null;
      if (!el || el.getClientRects().length === 0) {
        setRect(null);
        return false;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) {
        setRect(null);
        return false;
      }
      // Spotlight only — never scroll the page into place.
      setRect({
        top: r.top - 8,
        left: r.left - 8,
        width: r.width + 16,
        height: r.height + 16,
      });
      return true;
    }

    function tick() {
      if (cancelled) return;
      attempts += 1;
      if (measure()) return;
      if (attempts >= maxAttempts) return;
      if (attempts < 10) {
        raf = window.requestAnimationFrame(tick);
      } else {
        timer = window.setTimeout(tick, 24);
      }
    }

    raf = window.requestAnimationFrame(tick);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);

    const observer = new MutationObserver(() => {
      if (!cancelled) measure();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      observer.disconnect();
    };
  }, [target, ready, reduced]);

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

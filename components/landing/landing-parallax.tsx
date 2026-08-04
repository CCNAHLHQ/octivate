"use client";

import { useEffect, useRef } from "react";

/**
 * SaaS-grade multi-layer parallax backdrop for the marketing homepage.
 * Uses transform-only updates on scroll (GPU-friendly) and respects reduced motion.
 */
export function LandingParallax() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      root.setAttribute("data-static", "true");
      return;
    }

    const layers = Array.from(root.querySelectorAll<HTMLElement>("[data-depth]"));
    let ticking = false;
    let lastY = window.scrollY;

    const paint = () => {
      ticking = false;
      const y = lastY;
      const vh = window.innerHeight || 1;
      layers.forEach((el) => {
        const depth = Number(el.dataset.depth || 0);
        const shift = y * depth;
        const fade = Math.max(0.35, 1 - Math.min(y / (vh * 1.8), 0.55));
        el.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
        el.style.opacity = String(fade);
      });
    };

    const onScroll = () => {
      lastY = window.scrollY;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(paint);
      }
    };

    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="lp-parallax" ref={rootRef} aria-hidden="true">
      <div className="lp-parallax-layer lp-orb lp-orb-a" data-depth="0.12" />
      <div className="lp-parallax-layer lp-orb lp-orb-b" data-depth="0.22" />
      <div className="lp-parallax-layer lp-orb lp-orb-c" data-depth="0.08" />
      <div className="lp-parallax-layer lp-grid" data-depth="0.04" />
      <div className="lp-parallax-layer lp-ridge lp-ridge-1" data-depth="0.16" />
      <div className="lp-parallax-layer lp-ridge lp-ridge-2" data-depth="0.28" />
    </div>
  );
}

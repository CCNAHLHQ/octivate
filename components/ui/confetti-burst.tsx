"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
};

const COLORS = ["#2dd4bf", "#a78bfa", "#fb7185", "#fbbf24", "#38bdf8"];
const PARTICLE_COUNT = 48;
const DURATION_MS = 1600;

/**
 * Lightweight one-shot confetti on a fixed canvas.
 * Skips when the user prefers reduced motion.
 */
export function ConfettiBurst({
  fireKey,
  className,
}: {
  fireKey: string | number | null;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (fireKey == null) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let alive = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const originX = w * 0.5;
    const originY = h * 0.28;
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
      const speed = 4 + Math.random() * 7;
      return {
        x: originX + (Math.random() - 0.5) * 40,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        size: 3 + Math.random() * 3,
      };
    });

    const started = performance.now();

    function frame(now: number) {
      if (!alive || !ctx) return;
      const t = (now - started) / DURATION_MS;
      if (t >= 1) {
        ctx.clearRect(0, 0, w, h);
        return;
      }
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.vy += 0.18;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.life = 1 - t;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size * 0.7);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, w, h);
    };
  }, [fireKey]);

  if (fireKey == null) return null;

  return (
    <canvas
      ref={canvasRef}
      className={["brief-confetti-canvas", className].filter(Boolean).join(" ")}
      aria-hidden
    />
  );
}

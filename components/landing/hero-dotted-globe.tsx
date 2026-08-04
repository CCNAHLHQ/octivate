"use client";

import { useEffect, useRef } from "react";

type Dot = { x: number; y: number; z: number };

/** Fibonacci sphere — even distribution, cheap to rotate every frame. */
function buildDots(count: number): Dot[] {
  const dots: Dot[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    dots.push({
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
    });
  }
  return dots;
}

function rotateY(p: Dot, a: number): Dot {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}

function rotateX(p: Dot, a: number): Dot {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}

/**
 * Dotted globe hero visual — Canvas 2D, no WebGL, no pointer interaction.
 * Uses rAF + IntersectionObserver + ResizeObserver for efficient multi-browser sizing.
 */
export function HeroDottedGlobe() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    // Avoid `desynchronized: true` — on some Windows GPU/driver stacks it
    // composites cleared pixels as opaque black and shows a square "border".
    const ctx = canvas.getContext("2d", { alpha: true, colorSpace: "srgb" });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dots = buildDots(reduced ? 520 : 920);
    const tilt = -0.38;
    let rotY = 0.35;
    let raf = 0;
    let visible = true;
    let last = performance.now();
    let cssSize = 0;
    let dpr = 1;

    const clearTransparent = (w: number, h: number) => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      ctx.clearRect(0, 0, w, h);
      // Explicit transparent fill — defeats black backing-store leftovers.
      ctx.globalCompositeOperation = "copy";
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const syncSize = () => {
      const rect = wrap.getBoundingClientRect();
      const next = Math.max(180, Math.round(Math.min(rect.width, rect.height)));
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
      if (next === cssSize && nextDpr === dpr && canvas.width) return;
      cssSize = next;
      dpr = nextDpr;
      canvas.width = Math.max(1, Math.round(next * dpr));
      canvas.height = Math.max(1, Math.round(next * dpr));
      canvas.style.width = `${next}px`;
      canvas.style.height = `${next}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      clearTransparent(canvas.width, canvas.height);
    };

    const paint = () => {
      if (!cssSize) syncSize();
      const size = cssSize;
      const cx = size / 2;
      const cy = size / 2;
      // Keep the sphere + halo inside the bitmap with margin so soft edges
      // never clip into a hard black square boundary.
      const r = size * 0.34;

      clearTransparent(canvas.width, canvas.height);

      // Soft brand aura (reference-style halo) — fully transparent at rim
      const aura = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r * 1.42);
      aura.addColorStop(0, "rgba(137, 80, 238, 0.2)");
      aura.addColorStop(0.4, "rgba(77, 157, 247, 0.1)");
      aura.addColorStop(0.78, "rgba(137, 80, 238, 0.04)");
      aura.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.42, 0, Math.PI * 2);
      ctx.fill();

      // Ring / halo — no shadowBlur (GPU shadows often leave dark fringe)
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.06, 0, Math.PI * 2);
      const ring = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      ring.addColorStop(0, "rgba(77, 157, 247, 0.08)");
      ring.addColorStop(0.5, "rgba(137, 80, 238, 0.5)");
      ring.addColorStop(1, "rgba(77, 157, 247, 0.12)");
      ctx.strokeStyle = ring;
      ctx.lineWidth = Math.max(1.5, size * 0.007);
      ctx.stroke();

      // Soft outer glow ring (second pass, lighter)
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.12, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(137, 80, 238, 0.16)";
      ctx.lineWidth = Math.max(3, size * 0.014);
      ctx.stroke();

      // Frosted sphere — feathered alpha at the rim so it never reads as a plate
      const body = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.08, cx, cy, r);
      body.addColorStop(0, "rgba(180, 200, 255, 0.14)");
      body.addColorStop(0.45, "rgba(28, 40, 72, 0.38)");
      body.addColorStop(0.82, "rgba(12, 18, 34, 0.28)");
      body.addColorStop(1, "rgba(8, 12, 24, 0)");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Specular rim
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.985, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();

      for (let i = 0; i < dots.length; i++) {
        let p = rotateY(dots[i], rotY);
        p = rotateX(p, tilt);
        if (p.z < -0.08) continue;
        const depth = (p.z + 1) * 0.5;
        const sx = cx + p.x * r;
        const sy = cy + p.y * r;
        const pr = (0.55 + depth * 1.35) * (size / 420);
        const alpha = 0.18 + depth * 0.72;
        ctx.beginPath();
        ctx.fillStyle = `rgba(214, 226, 255, ${alpha.toFixed(3)})`;
        ctx.arc(sx, sy, pr, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const tick = (now: number) => {
      if (!visible || reduced) {
        raf = 0;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      rotY += dt * 0.28;
      paint();
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (reduced || raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    syncSize();
    paint();

    const ro = new ResizeObserver(() => {
      syncSize();
      paint();
    });
    ro.observe(wrap);

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          paint();
          start();
        } else if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0.05 }
    );
    io.observe(wrap);

    if (!reduced) start();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div className="hero-globe" ref={wrapRef} aria-hidden="true">
      <div className="hero-globe-glow" />
      <canvas ref={canvasRef} className="hero-globe-canvas" />
    </div>
  );
}

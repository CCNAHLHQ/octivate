"use client";

import type { ReactElement } from "react";
import { useEffect, useRef } from "react";
import type { IntroArtKind } from "@/lib/onboarding/content";
import { cn } from "@/lib/utils";

function SoftCanvas({ accent }: { accent: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let t0 = performance.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const paint = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w < 2 || h < 2) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const t = reduced ? 0 : (now - t0) / 1000;
      const cx = w * 0.72;
      const cy = h * 0.42;
      const r = Math.min(w, h) * 0.42;
      const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
      g.addColorStop(0, accent);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.35 + Math.sin(t * 0.7) * 0.05;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const yy = h * (0.2 + i * 0.15) + Math.sin(t * 0.5 + i) * 2;
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.bezierCurveTo(w * 0.35, yy - 8, w * 0.65, yy + 8, w, yy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      paint(now);
      if (!reduced) raf = requestAnimationFrame(tick);
    };

    paint(performance.now());
    if (!reduced) raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => paint(performance.now()));
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [accent]);

  return <canvas ref={ref} className="intro-art-canvas" aria-hidden />;
}

function OverviewArt() {
  return (
    <svg className="intro-art-svg" viewBox="0 0 320 140" fill="none" aria-hidden>
      <defs>
        <filter id="intro-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#030612" floodOpacity="0.45" />
        </filter>
      </defs>
      <rect x="18" y="18" width="72" height="104" rx="12" className="intro-art-panel" filter="url(#intro-soft)" />
      <rect x="28" y="30" width="36" height="8" rx="4" className="intro-art-fill-violet" opacity="0.85" />
      <rect x="28" y="48" width="52" height="6" rx="3" className="intro-art-line" />
      <rect x="28" y="60" width="44" height="6" rx="3" className="intro-art-line" />
      <rect x="28" y="72" width="48" height="6" rx="3" className="intro-art-line" />
      <rect x="28" y="94" width="52" height="18" rx="8" className="intro-art-fill-violet" opacity="0.55" />

      <rect x="104" y="18" width="198" height="48" rx="12" className="intro-art-panel" filter="url(#intro-soft)" />
      <rect x="118" y="32" width="90" height="8" rx="4" className="intro-art-fill-foam" />
      <rect x="118" y="46" width="140" height="6" rx="3" className="intro-art-line" />
      <circle cx="276" cy="42" r="10" className="intro-art-fill-tide" opacity="0.75" />

      <rect x="104" y="78" width="92" height="44" rx="12" className="intro-art-panel" filter="url(#intro-soft)" />
      <rect x="116" y="92" width="48" height="6" rx="3" className="intro-art-line" />
      <rect x="116" y="104" width="64" height="8" rx="4" className="intro-art-fill-tide" opacity="0.7" />

      <rect x="210" y="78" width="92" height="44" rx="12" className="intro-art-panel" filter="url(#intro-soft)" />
      <rect x="222" y="92" width="40" height="6" rx="3" className="intro-art-line" />
      <rect x="222" y="104" width="56" height="8" rx="4" className="intro-art-fill-violet" opacity="0.65" />
    </svg>
  );
}

function ProjectsArt() {
  return (
    <svg className="intro-art-svg" viewBox="0 0 320 140" fill="none" aria-hidden>
      <defs>
        <filter id="intro-proj" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#030612" floodOpacity="0.45" />
        </filter>
      </defs>
      <rect x="24" y="24" width="120" height="92" rx="14" className="intro-art-panel" filter="url(#intro-proj)" />
      <circle cx="48" cy="48" r="12" className="intro-art-fill-tide" opacity="0.85" />
      <rect x="68" y="42" width="58" height="7" rx="3.5" className="intro-art-fill-foam" />
      <rect x="68" y="54" width="40" height="5" rx="2.5" className="intro-art-line" />
      <rect x="36" y="76" width="88" height="5" rx="2.5" className="intro-art-line" />
      <rect x="36" y="88" width="72" height="5" rx="2.5" className="intro-art-line" />
      <rect x="36" y="100" width="54" height="5" rx="2.5" className="intro-art-line" />

      <rect x="160" y="24" width="136" height="92" rx="14" className="intro-art-panel" filter="url(#intro-proj)" />
      <rect x="176" y="40" width="70" height="8" rx="4" className="intro-art-fill-violet" opacity="0.8" />
      <rect x="176" y="58" width="104" height="6" rx="3" className="intro-art-line" />
      <rect x="176" y="72" width="88" height="6" rx="3" className="intro-art-line" />
      <rect x="176" y="92" width="78" height="14" rx="7" className="intro-art-fill-tide" opacity="0.7" />
      <path
        d="M250 44l8 8 14-16"
        className="intro-art-stroke-tide"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PipelineArt() {
  return (
    <svg className="intro-art-svg" viewBox="0 0 320 140" fill="none" aria-hidden>
      <defs>
        <filter id="intro-pipe" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#030612" floodOpacity="0.4" />
        </filter>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => {
        const x = 28 + i * 56;
        return (
          <g key={i} filter="url(#intro-pipe)">
            <rect
              x={x}
              y="42"
              width="44"
              height="56"
              rx="12"
              className="intro-art-panel"
            />
            <circle
              cx={x + 22}
              cy="62"
              r="8"
              className={i % 2 === 0 ? "intro-art-fill-violet" : "intro-art-fill-tide"}
              opacity="0.85"
            />
            <rect x={x + 10} y="78" width="24" height="5" rx="2.5" className="intro-art-line" />
            <rect x={x + 10} y="88" width="18" height="4" rx="2" className="intro-art-line" />
            {i < 4 ? (
              <path
                d={`M${x + 46} 70 H${x + 54}`}
                className="intro-art-stroke-violet"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="3 3"
              />
            ) : null}
          </g>
        );
      })}
      <rect x="28" y="18" width="120" height="10" rx="5" className="intro-art-fill-foam" opacity="0.7" />
    </svg>
  );
}

function BriefsArt() {
  return (
    <svg className="intro-art-svg" viewBox="0 0 320 140" fill="none" aria-hidden>
      <defs>
        <filter id="intro-brief" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#030612" floodOpacity="0.45" />
        </filter>
      </defs>
      <rect x="48" y="16" width="160" height="108" rx="14" className="intro-art-panel" filter="url(#intro-brief)" />
      <rect x="66" y="34" width="78" height="8" rx="4" className="intro-art-fill-amber" opacity="0.85" />
      <rect x="66" y="52" width="124" height="5" rx="2.5" className="intro-art-line" />
      <rect x="66" y="64" width="110" height="5" rx="2.5" className="intro-art-line" />
      <rect x="66" y="76" width="118" height="5" rx="2.5" className="intro-art-line" />
      <rect x="66" y="96" width="52" height="12" rx="6" className="intro-art-fill-violet" opacity="0.65" />
      <rect x="126" y="96" width="52" height="12" rx="6" className="intro-art-fill-tide" opacity="0.55" />

      <rect
        x="196"
        y="36"
        width="88"
        height="72"
        rx="12"
        className="intro-art-panel"
        filter="url(#intro-brief)"
        transform="rotate(6 240 72)"
      />
      <rect x="212" y="52" width="48" height="5" rx="2.5" className="intro-art-line" transform="rotate(6 236 54)" />
      <rect x="210" y="66" width="56" height="5" rx="2.5" className="intro-art-line" transform="rotate(6 238 68)" />
      <rect x="214" y="80" width="40" height="5" rx="2.5" className="intro-art-line" transform="rotate(6 234 82)" />
    </svg>
  );
}

function MonitorsArt() {
  return (
    <svg className="intro-art-svg" viewBox="0 0 320 140" fill="none" aria-hidden>
      <defs>
        <filter id="intro-mon" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#030612" floodOpacity="0.45" />
        </filter>
      </defs>
      <rect x="24" y="22" width="272" height="96" rx="16" className="intro-art-panel" filter="url(#intro-mon)" />
      <path
        d="M48 88 C72 88 78 48 104 48 C130 48 136 96 162 96 C188 96 194 40 220 40 C246 40 252 72 276 72"
        className="intro-art-stroke-tide"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="104" cy="48" r="5" className="intro-art-fill-tide" />
      <circle cx="162" cy="96" r="5" className="intro-art-fill-violet" />
      <circle cx="220" cy="40" r="5" className="intro-art-fill-amber" />
      <rect x="48" y="28" width="64" height="6" rx="3" className="intro-art-line" />
    </svg>
  );
}

function SupportArt() {
  return (
    <svg className="intro-art-svg" viewBox="0 0 320 140" fill="none" aria-hidden>
      <defs>
        <filter id="intro-sup" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#030612" floodOpacity="0.45" />
        </filter>
      </defs>
      <rect x="42" y="20" width="170" height="100" rx="18" className="intro-art-panel" filter="url(#intro-sup)" />
      <circle cx="66" cy="46" r="12" className="intro-art-fill-violet" opacity="0.9" />
      <rect x="86" y="40" width="70" height="6" rx="3" className="intro-art-fill-foam" />
      <rect x="86" y="52" width="44" height="5" rx="2.5" className="intro-art-line" />
      <rect x="58" y="72" width="110" height="18" rx="9" className="intro-art-bubble" />
      <rect x="58" y="96" width="86" height="14" rx="7" className="intro-art-bubble is-soft" />

      <circle cx="252" cy="96" r="28" className="intro-art-fill-violet" filter="url(#intro-sup)" opacity="0.95" />
      <path
        d="M242 96h20M252 86v20"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="268" cy="78" r="7" className="intro-art-fill-tide" />
    </svg>
  );
}

function MapArt() {
  return (
    <svg className="intro-art-svg" viewBox="0 0 320 140" fill="none" aria-hidden>
      <defs>
        <filter id="intro-map" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#030612" floodOpacity="0.45" />
        </filter>
      </defs>
      <rect x="28" y="18" width="264" height="104" rx="18" className="intro-art-panel" filter="url(#intro-map)" />
      <path
        d="M56 92 C78 70 96 58 118 62 C142 66 154 88 178 84 C204 80 218 52 244 54 C258 55 268 66 278 74"
        className="intro-art-stroke-tide"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="118" cy="62" r="7" className="intro-art-fill-tide" opacity="0.95" />
      <circle cx="178" cy="84" r="9" className="intro-art-fill-violet" opacity="0.9" />
      <circle cx="244" cy="54" r="6" className="intro-art-fill-amber" opacity="0.95" />
      <rect x="44" y="30" width="72" height="6" rx="3" className="intro-art-line" />
      <rect x="44" y="42" width="44" height="5" rx="2.5" className="intro-art-line" />
    </svg>
  );
}

function TranslateArt() {
  return (
    <svg className="intro-art-svg" viewBox="0 0 320 140" fill="none" aria-hidden>
      <defs>
        <filter id="intro-tr" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#030612" floodOpacity="0.45" />
        </filter>
      </defs>
      <rect x="36" y="24" width="120" height="92" rx="16" className="intro-art-panel" filter="url(#intro-tr)" />
      <rect x="52" y="42" width="54" height="8" rx="4" className="intro-art-fill-foam" />
      <rect x="52" y="58" width="72" height="6" rx="3" className="intro-art-line" />
      <rect x="52" y="72" width="48" height="6" rx="3" className="intro-art-line" />
      <rect x="176" y="24" width="112" height="92" rx="16" className="intro-art-panel" filter="url(#intro-tr)" />
      <rect x="192" y="42" width="64" height="8" rx="4" className="intro-art-fill-tide" />
      <rect x="192" y="58" width="76" height="6" rx="3" className="intro-art-line" />
      <rect x="192" y="72" width="52" height="6" rx="3" className="intro-art-line" />
      <path d="M156 70h12" className="intro-art-stroke-tide" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function ThemeArt() {
  return (
    <svg className="intro-art-svg" viewBox="0 0 320 140" fill="none" aria-hidden>
      <defs>
        <filter id="intro-th" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#030612" floodOpacity="0.45" />
        </filter>
      </defs>
      <rect x="40" y="28" width="110" height="84" rx="18" className="intro-art-panel" filter="url(#intro-th)" />
      <circle cx="95" cy="70" r="22" className="intro-art-fill-amber" opacity="0.9" />
      <rect x="170" y="28" width="110" height="84" rx="18" className="intro-art-panel" filter="url(#intro-th)" />
      <path
        d="M232 52a22 22 0 1 0 0 36 16 16 0 0 1 0-36z"
        className="intro-art-fill-violet"
        opacity="0.95"
      />
    </svg>
  );
}

function LegalArt() {
  return (
    <svg className="intro-art-svg" viewBox="0 0 320 140" fill="none" aria-hidden>
      <defs>
        <filter id="intro-leg" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#030612" floodOpacity="0.45" />
        </filter>
      </defs>
      <rect x="58" y="20" width="204" height="100" rx="16" className="intro-art-panel" filter="url(#intro-leg)" />
      <rect x="78" y="40" width="96" height="7" rx="3.5" className="intro-art-fill-foam" />
      <rect x="78" y="56" width="164" height="5" rx="2.5" className="intro-art-line" />
      <rect x="78" y="68" width="148" height="5" rx="2.5" className="intro-art-line" />
      <rect x="78" y="80" width="132" height="5" rx="2.5" className="intro-art-line" />
      <rect x="78" y="96" width="70" height="10" rx="5" className="intro-art-fill-tide" opacity="0.85" />
      <rect x="156" y="96" width="70" height="10" rx="5" className="intro-art-fill-violet" opacity="0.85" />
    </svg>
  );
}

const ART: Record<IntroArtKind, () => ReactElement> = {
  overview: OverviewArt,
  projects: ProjectsArt,
  pipeline: PipelineArt,
  briefs: BriefsArt,
  monitors: MonitorsArt,
  support: SupportArt,
  map: MapArt,
  translate: TranslateArt,
  theme: ThemeArt,
  legal: LegalArt,
};

const ACCENT_RGBA: Record<"violet" | "teal" | "amber", string> = {
  violet: "rgba(137, 80, 238, 0.55)",
  teal: "rgba(77, 157, 247, 0.5)",
  amber: "rgba(245, 158, 11, 0.45)",
};

export function IntroStepArt({
  kind,
  accent,
}: {
  kind: IntroArtKind;
  accent: "violet" | "teal" | "amber";
}) {
  const Scene = ART[kind];
  return (
    <div className={cn("intro-modal-visual", `is-${accent}`)}>
      <SoftCanvas accent={ACCENT_RGBA[accent]} />
      <div className="intro-modal-glow" aria-hidden />
      <div className="intro-art-scene">
        <Scene />
      </div>
    </div>
  );
}

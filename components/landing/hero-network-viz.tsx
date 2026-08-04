"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const VB_W = 560;
const VB_H = 480;
const CX = 280;
const CY = 228;

const NODES = [
  {
    id: "gov",
    label: "Gov portals",
    color: "#D8B4FE",
    glow: "rgba(168, 85, 247, 0.55)",
    x: 0.107,
    y: 0.125,
    delay: 0,
  },
  {
    id: "media",
    label: "Local media",
    color: "#FFA79C",
    glow: "rgba(255, 107, 91, 0.55)",
    x: 0.357,
    y: 0.058,
    delay: 0.35,
  },
  {
    id: "reg",
    label: "Regulators",
    color: "#7DEDE0",
    glow: "rgba(45, 212, 191, 0.55)",
    x: 0.657,
    y: 0.07,
    delay: 0.7,
  },
  {
    id: "donor",
    label: "Donor reports",
    color: "#BBD0FF",
    glow: "rgba(120, 160, 255, 0.5)",
    x: 0.9,
    y: 0.18,
    delay: 1.05,
  },
  {
    id: "field",
    label: "Field intel",
    color: "#F5B84B",
    glow: "rgba(245, 184, 75, 0.5)",
    x: 0.075,
    y: 0.42,
    delay: 1.4,
  },
  {
    id: "trade",
    label: "Trade flows",
    color: "#78A0FF",
    glow: "rgba(120, 160, 255, 0.5)",
    x: 0.815,
    y: 0.46,
    delay: 1.75,
  },
] as const;

type NodeId = (typeof NODES)[number]["id"];

function projectGlobePoint(
  latDeg: number,
  lonDeg: number,
  rotY: number,
  rotX: number,
  cx: number,
  cy: number,
  r: number
) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = ((lonDeg + rotY) * Math.PI) / 180;

  let x = Math.cos(lat) * Math.cos(lon);
  let y = Math.sin(lat);
  let z = Math.cos(lat) * Math.sin(lon);

  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y2 = y * cosX - z * sinX;
  const z2 = y * sinX + z * cosX;

  return {
    sx: cx + x * r,
    sy: cy - y2 * r,
    z: z2,
  };
}

function drawGlobe(
  ctx: CanvasRenderingContext2D,
  size: number,
  rotY: number,
  rotX: number,
  boost: number
) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;

  ctx.clearRect(0, 0, size, size);

  const halo = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r * 1.25);
  halo.addColorStop(0, `rgba(45, 212, 191, ${0.22 + boost * 0.12})`);
  halo.addColorStop(0.45, `rgba(168, 85, 247, ${0.12 + boost * 0.08})`);
  halo.addColorStop(1, "rgba(7, 11, 23, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.2, 0, Math.PI * 2);
  ctx.fill();

  const shell = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.05, cx, cy, r);
  shell.addColorStop(0, "rgba(125, 237, 224, 0.18)");
  shell.addColorStop(0.55, "rgba(168, 85, 247, 0.12)");
  shell.addColorStop(1, "rgba(12, 21, 38, 0.85)");
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  for (let lat = -78; lat <= 78; lat += 14) {
    ctx.beginPath();
    let open = false;
    for (let lon = -180; lon <= 180; lon += 4) {
      const p = projectGlobePoint(lat, lon, rotY, rotX, cx, cy, r);
      if (p.z < -0.08) {
        open = false;
        continue;
      }
      if (!open) {
        ctx.moveTo(p.sx, p.sy);
        open = true;
      } else {
        ctx.lineTo(p.sx, p.sy);
      }
    }
    ctx.strokeStyle = `rgba(125, 237, 224, ${0.08 + boost * 0.06})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  for (let lon = 0; lon < 360; lon += 22) {
    ctx.beginPath();
    let open = false;
    for (let lat = -90; lat <= 90; lat += 4) {
      const p = projectGlobePoint(lat, lon, rotY, rotX, cx, cy, r);
      if (p.z < -0.08) {
        open = false;
        continue;
      }
      if (!open) {
        ctx.moveTo(p.sx, p.sy);
        open = true;
      } else {
        ctx.lineTo(p.sx, p.sy);
      }
    }
    ctx.strokeStyle = `rgba(168, 85, 247, ${0.14 + boost * 0.08})`;
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }

  for (let lat = -60; lat <= 60; lat += 18) {
    for (let lon = 0; lon < 360; lon += 18) {
      const p = projectGlobePoint(lat, lon, rotY, rotX, cx, cy, r);
      if (p.z < 0.05) continue;
      const dotR = 0.8 + ((p.z + 1) / 2) * 1.4;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(234, 240, 255, ${0.12 + p.z * 0.35})`;
      ctx.fill();
    }
  }

  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(168, 85, 247, ${0.35 + boost * 0.2})`;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 107, 91, ${0.75 + boost * 0.2})`;
  ctx.fill();
}

export function HeroNetworkViz() {
  const reduceMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const rotRef = useRef({ y: 0, x: -0.32 });
  const boostRef = useRef(0);
  const [active, setActive] = useState<NodeId | null>(null);

  const nodeCoords = NODES.map((n) => ({
    ...n,
    px: n.x * VB_W,
    py: n.y * VB_H,
  }));

  const paintGlobe = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = canvas.clientWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGlobe(ctx, size, rotRef.current.y, rotRef.current.x, boostRef.current);
  }, []);

  useEffect(() => {
    boostRef.current = active ? 1 : 0;
  }, [active]);

  useEffect(() => {
    if (reduceMotion) {
      paintGlobe();
      return;
    }

    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const speed = active ? 0.95 : 0.42;
      rotRef.current.y += dt * speed;
      paintGlobe();
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active, paintGlobe, reduceMotion]);

  useEffect(() => {
    const onResize = () => paintGlobe();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [paintGlobe]);

  return (
    <div className="net-wrap hero-net-v2">
      <svg className="net-svg" viewBox={`0 0 ${VB_W} ${VB_H}`} xmlns="http://www.w3.org/2000/svg">
        <defs>
          {nodeCoords.map((node) => (
            <linearGradient
              key={node.id}
              id={`net-grad-${node.id}`}
              gradientUnits="userSpaceOnUse"
              x1={node.px}
              y1={node.py}
              x2={CX}
              y2={CY}
            >
              <stop offset="0%" stopColor={node.color} stopOpacity="0.92" />
              <stop offset="55%" stopColor={node.color} stopOpacity="0.45" />
              <stop offset="100%" stopColor="#A855F7" stopOpacity="0.08" />
            </linearGradient>
          ))}
          <radialGradient id="net-hub-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(168, 85, 247, 0.2)" />
            <stop offset="100%" stopColor="rgba(168, 85, 247, 0)" />
          </radialGradient>
        </defs>

        <circle cx={CX} cy={CY} r="88" fill="url(#net-hub-glow)" />

        {nodeCoords.map((node) => {
          const lit = !active || active === node.id;
          return (
            <g key={node.id} className={cn("net-link", lit && "is-lit", active === node.id && "is-active")}>
              <line
                className="net-line-base"
                x1={node.px}
                y1={node.py}
                x2={CX}
                y2={CY}
                stroke={node.glow.replace("0.55", "0.14")}
              />
              <line
                className="net-line-beam"
                x1={node.px}
                y1={node.py}
                x2={CX}
                y2={CY}
                stroke={`url(#net-grad-${node.id})`}
                style={{ animationDelay: `${node.delay}s` }}
              />
              <line
                className="net-line-pulse"
                x1={node.px}
                y1={node.py}
                x2={CX}
                y2={CY}
                stroke={node.color}
                style={{ animationDelay: `${node.delay}s` }}
              />
            </g>
          );
        })}
      </svg>

      <canvas ref={canvasRef} className="net-globe-canvas" aria-hidden />

      {nodeCoords.map((node) => (
        <button
          key={node.id}
          type="button"
          className={cn("net-chip net-chip-btn", active === node.id && "is-active")}
          style={{ left: `${node.x * 100}%`, top: `${node.y * 100}%` }}
          onMouseEnter={() => setActive(node.id)}
          onMouseLeave={() => setActive(null)}
          onFocus={() => setActive(node.id)}
          onBlur={() => setActive(null)}
        >
          <i style={{ background: node.color, boxShadow: `0 0 10px ${node.glow}` }} />
          {node.label}
        </button>
      ))}

      <div className="brief-float hero-brief-card">
        <span className="bf-tag">Decision brief · output</span>
        <div className="bf-title">Guyana energy services — phased entry recommended</div>
        <div className="bf-row">
          <span>Confidence</span>
          <b style={{ color: "var(--hero-viz-accent-teal)" }}>Moderate–High · 72</b>
        </div>
        <div className="bf-row">
          <span>Evidence gaps</span>
          <b>3 flagged</b>
        </div>
        <div className="bf-row">
          <span>Analyst review</span>
          <b style={{ color: "var(--hero-viz-accent-violet)" }}>Cleared</b>
        </div>
      </div>
    </div>
  );
}

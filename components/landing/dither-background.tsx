"use client";

import { useEffect, useRef } from "react";

/**
 * Animated monochrome dither backdrop for the hero.
 *
 * A slow, aspect-correct wave field is quantised through an 8-level ordered
 * (Bayer 4x4) dither into chunky lo-fi cells, then tinted with the brand
 * periwinkle/violet and composited with premultiplied alpha so it sits cleanly
 * over the page background. Colours + master opacity are read from CSS custom
 * properties so the effect tracks the active theme.
 *
 * Dependency-free WebGL2; degrades to nothing where WebGL2 is unavailable and
 * renders a single static frame when the user prefers reduced motion.
 */

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2  uRes;
uniform float uTime;
uniform vec3  uTint;
uniform float uAlpha;
uniform float uCell;

const float bayer[16] = float[16](
   0.0,  8.0,  2.0, 10.0,
  12.0,  4.0, 14.0,  6.0,
   3.0, 11.0,  1.0,  9.0,
  15.0,  7.0, 13.0,  5.0
);

float field(vec2 uv, float t) {
  float v = 0.0;
  v += sin(uv.x * 3.1 + t);
  v += sin(uv.y * 2.7 - t * 1.2);
  v += sin((uv.x + uv.y) * 2.2 + t * 0.8);
  v += sin(length(uv - vec2(0.85, 0.15)) * 5.5 - t * 1.6);
  return v / 4.0 * 0.5 + 0.5;
}

void main() {
  // Snap to a dither cell for the crisp lo-fi grain.
  vec2 cellId = floor(gl_FragCoord.xy / uCell);
  vec2 frag = cellId * uCell;
  vec2 uv = frag / uRes.y; // aspect-correct against height

  float t = uTime * 0.05;
  float v = field(uv, t);

  // Bias intensity toward the top of the hero, fade toward the bottom.
  float top = 1.0 - clamp(gl_FragCoord.y / uRes.y, 0.0, 1.0);
  v *= mix(0.5, 1.0, smoothstep(0.0, 1.0, top));

  // Ordered dithering into discrete levels.
  ivec2 bc = ivec2(mod(cellId, 4.0));
  float threshold = (bayer[bc.y * 4 + bc.x] + 0.5) / 16.0;
  float levels = 4.0;
  float d = clamp(floor(v * levels + threshold) / levels, 0.0, 1.0);

  float a = d * uAlpha;
  // Premultiplied alpha output (blend: ONE, ONE_MINUS_SRC_ALPHA).
  outColor = vec4(uTint * a, a);
}`;

type Palette = { tint: [number, number, number]; alpha: number };

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const rawTint = cs.getPropertyValue("--dither-tint").trim();
  const rawAlpha = cs.getPropertyValue("--dither-alpha").trim();

  let tint: [number, number, number] = [0.6, 0.67, 1.0];
  const parts = rawTint.split(",").map((p) => parseFloat(p.trim()));
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    tint = [parts[0] / 255, parts[1] / 255, parts[2] / 255];
  }

  const alpha = Number.isFinite(parseFloat(rawAlpha)) ? parseFloat(rawAlpha) : 0.16;
  return { tint, alpha };
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function DitherBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    });
    if (!gl) return;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uTint = gl.getUniformLocation(program, "uTint");
    const uAlpha = gl.getUniformLocation(program, "uAlpha");
    const uCell = gl.getUniformLocation(program, "uCell");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cell = 2 * dpr; // device-px per dither dot
    let palette = readPalette(canvas);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const draw = (timeMs: number) => {
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, timeMs / 1000);
      gl.uniform3f(uTint, palette.tint[0], palette.tint[1], palette.tint[2]);
      gl.uniform1f(uAlpha, palette.alpha);
      gl.uniform1f(uCell, cell);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    let raf = 0;
    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    resize();
    if (reduced) {
      draw(0);
    } else {
      raf = requestAnimationFrame(loop);
    }

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(0);
    });
    ro.observe(canvas);

    // Re-read palette when the theme flips.
    const mo = new MutationObserver(() => {
      palette = readPalette(canvas);
      if (reduced) draw(0);
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <div className={className} aria-hidden>
      <canvas ref={canvasRef} />
    </div>
  );
}

"use client";

import { OctivateLogo } from "@/components/brand";

const MARKS = [
  { className: "is-a", height: 120 },
  { className: "is-b", height: 88 },
  { className: "is-c", height: 160 },
  { className: "is-d", height: 72 },
  { className: "is-e", height: 108 },
  { className: "is-f", height: 140 },
  { className: "is-g", height: 64 },
  { className: "is-h", height: 96 },
] as const;

/** Soft drifting Octivate logo watermarks for auth visual panes. */
export function AuthLogoWatermarks() {
  return (
    <div className="auth-watermarks" aria-hidden="true">
      {MARKS.map((m) => (
        <span key={m.className} className={`auth-watermark ${m.className}`}>
          <OctivateLogo variant="lockup" height={m.height} decorative />
        </span>
      ))}
    </div>
  );
}

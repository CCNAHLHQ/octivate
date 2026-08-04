"use client";

import {
  LOGO_MARK_CIRCLES,
  LOGO_MARK_STAR,
  LOGO_MARK_VIEWBOX,
  LOGO_WORDMARK,
} from "@/components/brand/logo-geometry";

const PSN_TICKER = [
  { kind: "power", text: "Power" },
  { kind: "systems", text: "Systems" },
  { kind: "narrative", text: "Narrative" },
  { kind: "power", text: "Evidence labeled" },
  { kind: "systems", text: "Capture routed" },
  { kind: "narrative", text: "Brief scored" },
  { kind: "power", text: "Decision theatre" },
  { kind: "systems", text: "Local artifacts" },
  { kind: "narrative", text: "Keyword indicators" },
] as const;

/** Subtle animated Octivate watermark + PSN marquee — VC-ready, non-interactive. */
export function BrandBackdrop({ marquee = true }: { marquee?: boolean }) {
  const { purple, coral, blue } = LOGO_MARK_CIRCLES;
  const loop = [...PSN_TICKER, ...PSN_TICKER];
  return (
    <div className={marquee ? "ws-brand-backdrop is-marquee" : "ws-brand-backdrop"} aria-hidden>
      <svg
        className="ws-brand-backdrop-mark"
        viewBox={LOGO_MARK_VIEWBOX}
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle className="ws-bd-c ws-bd-purple" cx={purple.cx} cy={purple.cy} r={purple.r} />
        <circle className="ws-bd-c ws-bd-coral" cx={coral.cx} cy={coral.cy} r={coral.r} />
        <circle className="ws-bd-c ws-bd-blue" cx={blue.cx} cy={blue.cy} r={blue.r} />
        <path className="ws-bd-star" d={LOGO_MARK_STAR} />
      </svg>
      <span className="ws-brand-backdrop-word">{LOGO_WORDMARK}</span>
      {marquee ? (
        <div className="ws-project-psn-marquee">
          <div className="ws-project-psn-marquee-track">
            {loop.map((item, i) => (
              <span key={`${item.text}-${i}`} className={`is-${item.kind}`}>
                {item.text}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

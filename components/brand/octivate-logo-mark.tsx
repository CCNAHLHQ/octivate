import type { CSSProperties } from "react";
import {
  LOGO_MARK_CIRCLES,
  LOGO_MARK_STAR,
  LOGO_MARK_VIEWBOX,
} from "@/components/brand/logo-geometry";
import { cn } from "@/lib/utils";

export function OctivateLogoMark({
  className,
  style,
  title = "Octivate",
  decorative = false,
}: {
  className?: string;
  style?: CSSProperties;
  title?: string;
  /** When nested inside a parent with aria-label. */
  decorative?: boolean;
}) {
  const { purple, coral, blue } = LOGO_MARK_CIRCLES;

  return (
    <svg
      className={cn("octivate-logo-mark", className)}
      viewBox={LOGO_MARK_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      style={style}
    >
      {!decorative && <title>{title}</title>}
      <g className="octivate-logo-mark-circles" opacity="0.92">
        {/* Paint order matches official art: coral, blue, purple */}
        <circle {...coral} className="octivate-logo-circle is-coral" />
        <circle {...blue} className="octivate-logo-circle is-blue" />
        <circle {...purple} className="octivate-logo-circle is-purple" />
      </g>
      <path d={LOGO_MARK_STAR} className="octivate-logo-star" />
    </svg>
  );
}

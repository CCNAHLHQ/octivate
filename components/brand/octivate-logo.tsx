import {
  LOGO_ASPECT,
  LOGO_MARK_CIRCLES,
  LOGO_MARK_STAR,
  LOGO_STACKED_VIEWBOX,
  LOGO_WORDMARK,
} from "@/components/brand/logo-geometry";
import { OctivateLogoMark } from "@/components/brand/octivate-logo-mark";
import { cn } from "@/lib/utils";

export type OctivateLogoVariant = "mark" | "stacked" | "lockup";

export function OctivateLogo({
  variant = "mark",
  height = 32,
  className,
  sub,
  title = "Octivate",
  hideWordmark = false,
  decorative = false,
}: {
  variant?: OctivateLogoVariant;
  /** Primary sizing dimension in px — width follows aspect ratio. */
  height?: number;
  className?: string;
  sub?: string;
  title?: string;
  /** Lockup only — icon without OCTIVATE text column. */
  hideWordmark?: boolean;
  /** Suppress nested mark accessibility when parent names the logo. */
  decorative?: boolean;
}) {
  if (variant === "mark") {
    const width = Math.round(height * LOGO_ASPECT.mark);
    return (
      <OctivateLogoMark
        className={className}
        title={title}
        decorative={decorative}
        style={{ width, height, display: "block" }}
      />
    );
  }

  if (variant === "stacked") {
    const width = Math.round(height * LOGO_ASPECT.stacked);
    const { purple, coral, blue } = LOGO_MARK_CIRCLES;

    return (
      <svg
        className={cn("octivate-logo octivate-logo--stacked", className)}
        viewBox={LOGO_STACKED_VIEWBOX}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={title}
        style={{ width, height, display: "block" }}
      >
        <title>{title}</title>
        <g transform="translate(16 0)" opacity="0.92">
          <circle {...coral} className="octivate-logo-circle is-coral" />
          <circle {...blue} className="octivate-logo-circle is-blue" />
          <circle {...purple} className="octivate-logo-circle is-purple" />
          <path d={LOGO_MARK_STAR} className="octivate-logo-star" />
        </g>
        <text x="60" y="132" textAnchor="middle" className="octivate-logo-wordmark-svg">
          {LOGO_WORDMARK}
        </text>
      </svg>
    );
  }

  const markHeight = Math.round(height * 0.95);
  const markWidth = Math.round(markHeight * LOGO_ASPECT.mark);

  return (
    <span
      className={cn("octivate-logo octivate-logo--lockup", className)}
      role={decorative ? "presentation" : "img"}
      aria-label={decorative ? undefined : title}
      aria-hidden={decorative ? true : undefined}
      style={{ height }}
    >
      <OctivateLogoMark
        className="octivate-logo-lockup-mark"
        title={title}
        decorative
        style={{ width: markWidth, height: markHeight }}
      />
      {!hideWordmark && (
        <span className="octivate-logo-lockup-copy">
          <span className="octivate-logo-lockup-name">{LOGO_WORDMARK}</span>
          {sub ? <span className="octivate-logo-lockup-sub">{sub}</span> : null}
        </span>
      )}
    </span>
  );
}

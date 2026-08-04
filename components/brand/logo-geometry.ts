/** Official Octivate logo geometry — shared by React SVG + static icons. */

export const LOGO_MARK_VIEWBOX = "0 0 88 76";

export const LOGO_STACKED_VIEWBOX = "0 0 120 148";

/**
 * Three overlapping translucent discs + central sparkle.
 * Coral (power warmth) · Blue (systems) · Purple (brand) — matches official lockup art.
 */
export const LOGO_MARK_CIRCLES = {
  coral: { cx: 28, cy: 28, r: 26 },
  blue: { cx: 60, cy: 28, r: 26 },
  purple: { cx: 44, cy: 52, r: 26 },
} as const;

/** Four-point sparkle at the triple-overlap center. */
export const LOGO_MARK_STAR =
  "M44 30.5 C45.9 34.4 47.4 36.7 50.4 38.9 C47.4 41.1 45.9 43.4 44 47.3 C42.1 43.4 40.6 41.1 37.6 38.9 C40.6 36.7 42.1 34.4 44 30.5 Z";

export const LOGO_WORDMARK = "OCTIVATE";

export const LOGO_ASPECT = {
  mark: 88 / 76,
  stacked: 120 / 148,
  lockup: 2.85,
} as const;

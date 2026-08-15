/** Shared Recharts theme tokens — prefer CSS vars so light/dark both stay readable. */

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Static fallbacks for SSR / first paint; live charts can re-read via chartCss(). */
export const CHART = {
  foam: "#EAF0FF",
  mist: "#9AA8C7",
  faint: "#66759B",
  ink: "#0C1526",
  line: "rgba(154, 171, 255, 0.22)",
  grid: "rgba(154, 171, 255, 0.08)",
  /** Prefer --chart-track (theme-aware) over white alpha. */
  track: "var(--chart-track, rgba(71, 85, 120, 0.14))",
  trackStrong: "var(--chart-track-strong, rgba(71, 85, 120, 0.22))",
  cursor: "rgba(168, 85, 247, 0.12)",
  palette: ["#A855F7", "#2DD4BF", "#FF6B5B", "#F5B84B", "#78A0FF", "#99F6E4"],
  tick: {
    fill: "#9AA8C7",
    fontSize: 12,
    fontFamily: "var(--font-mono)",
  },
  label: {
    fill: "var(--chart-label, var(--foam, #EAF0FF))",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "var(--font-mono)",
  },
} as const;

/** Resolve live theme colors for Recharts fills that cannot use CSS vars reliably. */
export function chartCss() {
  return {
    track: cssVar("--chart-track", "rgba(71, 85, 120, 0.14)"),
    trackStrong: cssVar("--chart-track-strong", "rgba(71, 85, 120, 0.22)"),
    label: cssVar("--chart-label", cssVar("--foam", "#101a2e")),
    foam: cssVar("--foam", "#101a2e"),
    mist: cssVar("--mist", "#475569"),
  };
}

export const DEFAULT_CHART_HEIGHT = "h-[13.5rem]"; /* 216px */
export const TALL_CHART_HEIGHT = "h-[15rem]"; /* 240px */

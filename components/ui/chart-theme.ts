/** Shared Recharts theme tokens — matches octivate-theme.css */
export const CHART = {
  foam: "#EAF0FF",
  mist: "#9AA8C7",
  faint: "#66759B",
  ink: "#0C1526",
  line: "rgba(154, 171, 255, 0.22)",
  grid: "rgba(154, 171, 255, 0.08)",
  track: "rgba(255, 255, 255, 0.06)",
  trackStrong: "rgba(255, 255, 255, 0.1)",
  cursor: "rgba(168, 85, 247, 0.12)",
  palette: ["#A855F7", "#2DD4BF", "#FF6B5B", "#F5B84B", "#78A0FF", "#99F6E4"],
  tick: {
    fill: "#9AA8C7",
    fontSize: 12,
    fontFamily: "var(--font-mono)",
  },
  label: {
    fill: "#EAF0FF",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "var(--font-mono)",
  },
} as const;

export const DEFAULT_CHART_HEIGHT = "h-[13.5rem]"; /* 216px */
export const TALL_CHART_HEIGHT = "h-[15rem]"; /* 240px */

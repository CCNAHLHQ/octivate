import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        abyss: "var(--abyss)",
        "abyss-2": "var(--abyss-2)",
        foam: "var(--foam)",
        mist: "var(--mist)",
        faint: "var(--faint)",
        violet: "var(--violet)",
        "violet-deep": "var(--violet-deep)",
        tide: "var(--tide)",
        teal: "var(--tide)",
        "teal-deep": "#0D9488",
        coral: "var(--coral)",
        amber: "var(--amber)",
        info: "#38BDF8",
        navy: "#0B1F3A",
      },
      fontFamily: {
        display: ['var(--font-display)', '"Bricolage Grotesque"', "system-ui", "sans-serif"],
        body: ['var(--font-body)', '"Instrument Sans"', "system-ui", "sans-serif"],
        mono: ['var(--font-mono)', '"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "10px",
        md: "14px",
        lg: "20px",
        xl: "28px",
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
        pop: "var(--shadow-pop)",
        glow: "0 0 24px var(--glow-v)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
export default config;

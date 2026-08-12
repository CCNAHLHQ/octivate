"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";
import { DEFAULT_THEME } from "@/lib/theme/constants";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  variant = "nav",
  className,
}: {
  variant?: "nav" | "footer";
  className?: string;
}) {
  const { theme, toggleTheme, mounted } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      className={cn(
        "theme-toggle",
        variant === "footer" && "theme-toggle--footer",
        className
      )}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      data-theme-state={mounted ? theme : DEFAULT_THEME}
      data-tour="chrome-theme"
    >
      <Sun className="theme-toggle-icon is-sun" aria-hidden strokeWidth={2.1} />
      <Moon className="theme-toggle-icon is-moon" aria-hidden strokeWidth={2.1} />
    </button>
  );
}

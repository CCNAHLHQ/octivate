export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "octivate-theme";
export const THEME_EVENT = "octivate:theme-change";

export const DEFAULT_THEME: ThemeMode = "light";

export function isThemeMode(value: string | null | undefined): value is ThemeMode {
  return value === "light" || value === "dark";
}

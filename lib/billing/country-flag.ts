/** ISO 3166-1 alpha-2 → regional-indicator flag emoji (e.g. JM → 🇯🇲). */
export function countryFlagEmoji(code: string): string {
  const c = code.trim().toUpperCase();
  if (c.length !== 2 || c === "OTHER") return "🌐";
  const A = 0x1f1e6;
  const base = "A".charCodeAt(0);
  return String.fromCodePoint(
    A + (c.charCodeAt(0) - base),
    A + (c.charCodeAt(1) - base)
  );
}

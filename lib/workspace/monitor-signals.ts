import type { MarqueeItem, Monitor, MonitorSignal, Trend } from "@/lib/types";

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function countryMatches(monitorCountries: string[], targetCountry: string) {
  const target = normalize(targetCountry);
  return monitorCountries.some((c) => {
    const country = normalize(c);
    return target.includes(country) || country.includes(target);
  });
}

function findMatchedKeywords(text: string, keywords: string[]) {
  const haystack = normalize(text);
  return keywords.filter((kw) => haystack.includes(normalize(kw)));
}

export function matchTrendsToMonitor(monitor: Monitor, trends: Trend[]): MonitorSignal[] {
  return trends
    .filter((t) => countryMatches(monitor.countries, t.country))
    .map((t) => {
      const blob = `${t.title} ${t.summary} ${t.sector}`;
      const matchedKeywords = findMatchedKeywords(blob, monitor.keywords);
      return { trend: t, matchedKeywords };
    })
    .filter(({ matchedKeywords }) => matchedKeywords.length > 0)
    .map(({ trend, matchedKeywords }) => ({
      id: `sig_${trend.id}`,
      source: "trend" as const,
      title: trend.title,
      summary: trend.summary,
      severity: trend.severity,
      publishedAt: trend.publishedAt,
      matchedKeywords,
    }))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export function matchMarqueeToMonitor(monitor: Monitor, items: MarqueeItem[]): MonitorSignal[] {
  return items
    .filter((item) => item.enabled)
    .map((item) => {
      const blob = `${item.badge} ${item.text}`;
      const matchedKeywords = findMatchedKeywords(blob, monitor.keywords);
      return { item, matchedKeywords };
    })
    .filter(({ matchedKeywords }) => matchedKeywords.length > 0)
    .map(({ item, matchedKeywords }) => ({
      id: `sig_${item.id}`,
      source: "marquee" as const,
      title: item.badge,
      summary: item.text,
      badge: item.badge,
      publishedAt: item.createdAt,
      matchedKeywords,
    }))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export function collectMonitorSignals(
  monitor: Monitor,
  trends: Trend[],
  marquee: MarqueeItem[]
): MonitorSignal[] {
  const combined = [...matchTrendsToMonitor(monitor, trends), ...matchMarqueeToMonitor(monitor, marquee)];
  return combined.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export function inferDocumentType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "PDF";
  if (ext === "md" || ext === "markdown") return "Markdown";
  if (ext === "doc" || ext === "docx") return "Word";
  if (ext === "txt") return "Text";
  if (ext === "csv" || ext === "xlsx") return "Spreadsheet";
  return ext ? ext.toUpperCase() : "File";
}

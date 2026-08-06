import bundled from "@/lib/future-caribbean/entries.json";
import type { FcDayEntry } from "@/lib/future-caribbean/types";
import { FC_GITHUB_RAW_BASE } from "@/lib/future-caribbean/config";

type RawEntries = {
  meta?: Record<string, unknown>;
  weeks: Array<{
    label: string;
    days: Array<{ key: string; title: string; body: string; screenshot?: string }>;
  }>;
};

function shotUrl(key: string) {
  return `${FC_GITHUB_RAW_BASE}/${key.replace(/\s+/g, "_").replace(/\//g, "_")}.png`;
}

export async function loadFcEntries(): Promise<{
  meta: Record<string, unknown>;
  days: FcDayEntry[];
}> {
  const raw = bundled as RawEntries;
  const days: FcDayEntry[] = [];
  for (const w of raw.weeks || []) {
    for (const d of w.days || []) {
      const screenshot = d.screenshot || shotUrl(d.key);
      let body = d.body || "";
      if (!body.includes("Evidence screenshot:")) {
        body += `\n\nEvidence screenshot: ${screenshot}`;
      }
      days.push({
        key: d.key,
        title: d.title,
        body: body.startsWith(d.title) ? body : `${d.title}\n\n${body}`,
        screenshot,
        weekLabel: w.label,
      });
    }
  }
  return { meta: raw.meta || {}, days };
}

export function screenshotFilename(key: string) {
  return `${key.replace(/\s+/g, "_").replace(/\//g, "_")}.png`;
}

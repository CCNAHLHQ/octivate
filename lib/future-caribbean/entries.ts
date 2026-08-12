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

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function shotUrl(key: string) {
  return `${FC_GITHUB_RAW_BASE}/${key.replace(/\s+/g, "_").replace(/\//g, "_")}.png`;
}

/** Local calendar key matching entries.json, e.g. "Tue 08/11". */
export function fcKeyFromDate(date: Date = new Date()): string {
  const dow = DOW[date.getDay()];
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${dow} ${mm}/${dd}`;
}

export function yesterdayFcKey(date: Date = new Date()): string {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return fcKeyFromDate(d);
}

export function parseFcKey(key: string): Date | null {
  const m = /^([A-Za-z]{3})\s+(\d{1,2})\/(\d{1,2})$/.exec(key.trim());
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!month || !day) return null;
  const year = new Date().getFullYear();
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function recentFcKeys(date: Date = new Date()): string[] {
  return [fcKeyFromDate(date), yesterdayFcKey(date)];
}

export async function loadFcEntries(): Promise<{
  meta: Record<string, unknown>;
  days: FcDayEntry[];
  weeks: Array<{ label: string; days: FcDayEntry[] }>;
}> {
  const raw = bundled as RawEntries;
  const days: FcDayEntry[] = [];
  const weeks: Array<{ label: string; days: FcDayEntry[] }> = [];

  for (const w of raw.weeks || []) {
    const weekDays: FcDayEntry[] = [];
    for (const d of w.days || []) {
      const screenshot = d.screenshot || shotUrl(d.key);
      let body = d.body || "";
      if (!body.includes("Evidence screenshot:")) {
        body += `\n\nEvidence screenshot: ${screenshot}`;
      }
      const entry: FcDayEntry = {
        key: d.key,
        title: d.title,
        body: body.startsWith(d.title) ? body : `${d.title}\n\n${body}`,
        screenshot,
        weekLabel: w.label,
      };
      days.push(entry);
      weekDays.push(entry);
    }
    weeks.push({ label: w.label, days: weekDays });
  }

  return { meta: raw.meta || {}, days, weeks };
}

export function screenshotFilename(key: string) {
  return `${key.replace(/\s+/g, "_").replace(/\//g, "_")}.png`;
}

import type { CountryCode, CrawlSeed } from "@/lib/parliamentary/types";

/**
 * Verified media sources (recon Aug 2026).
 * BB video catalogue lives on the official Vimeo showcase; GY embeds Vimeo on sitting detail pages.
 * TT/JM are YouTube-primary and are intentionally omitted from download sources.
 */
export const SOURCES_REV = 3;

export type VerifiedSource = {
  country: CountryCode;
  url: string;
  label: string;
  kind: "vimeo_showcase" | "site_pages";
  notes: string;
  enabled?: boolean;
};

export const VERIFIED_SOURCES: VerifiedSource[] = [
  {
    country: "BB",
    url: "https://vimeo.com/barbadosparliament/videos",
    label: "Barbados Vimeo showcase",
    kind: "vimeo_showcase",
    notes: "Primary BB catalogue — sitting titles are topics (House/Senate/JSC parts)",
    enabled: true,
  },
  {
    country: "BB",
    url: "https://www.barbadosparliament.com/parliament_tv",
    label: "Barbados Parliament TV",
    kind: "site_pages",
    notes: "Live Vimeo event embed + link through to the showcase",
    enabled: true,
  },
  {
    country: "GY",
    url: "https://parliament.gov.gy/",
    label: "Guyana Parliament home",
    kind: "site_pages",
    notes: "Sitting cards with Video links to /sittings/detail/* (player.vimeo embeds)",
    enabled: true,
  },
  {
    country: "GY",
    url: "https://parliament.gov.gy/chamber-business/sittings/",
    label: "Guyana sittings index",
    kind: "site_pages",
    notes: "Chamber sittings index — follow detail pages for Vimeo players",
    enabled: true,
  },
];

/** Known non-Vimeo / obsolete seeds from earlier crawls — never keep these. */
export const OBSOLETE_SOURCE_URLS = new Set([
  "https://www.barbadosparliament.com/",
  "https://www.barbadosparliament.com",
  "https://www.ttparliament.org/parliament-channel/",
  "https://www.ttparliament.org/house/sittings-in-the-house/",
  "https://www.ttparliament.org/senate/sittings-in-the-senate/",
  "https://japarliament.gov.jm/",
  "https://japarliament.gov.jm",
]);

export function normalizeSourceUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
    return u.href;
  } catch {
    return raw.trim();
  }
}

export function isObsoleteSourceUrl(url: string): boolean {
  const n = normalizeSourceUrl(url);
  if (OBSOLETE_SOURCE_URLS.has(n) || OBSOLETE_SOURCE_URLS.has(n + "/")) return true;
  if (/ttparliament\.org/i.test(n)) return true;
  if (/japarliament\.gov\.jm/i.test(n)) return true;
  if (/youtube\.com|youtu\.be/i.test(n)) return true;
  return false;
}

export function inferSourceKind(url: string): CrawlSeed["kind"] {
  return /vimeo\.com\/[^/]+\/videos/i.test(url) || /vimeo\.com\/barbadosparliament/i.test(url)
    ? "vimeo_showcase"
    : "site_pages";
}

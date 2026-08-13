import type { MediaPlatform } from "@/lib/parliamentary/types";

const VIMEO_VIDEO =
  /(?:https?:)?\/\/(?:www\.)?(?:player\.)?vimeo\.com\/(?:video\/)?(\d{6,12})\b/gi;
const VIMEO_EVENT =
  /(?:https?:)?\/\/(?:www\.)?vimeo\.com\/event\/(\d+)/i;
const VIMEO_SHOWCASE =
  /(?:https?:)?\/\/(?:www\.)?vimeo\.com\/([a-z0-9_-]+)\/videos\b/i;
const DIRECT =
  /\.(mp4|webm|mov|m4v|m3u8)(\?|#|$)/i;
const YOUTUBE = /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;

export function isYoutubeUrl(url: string) {
  return YOUTUBE.test(url);
}

export function parseVimeoVideoId(url: string): string | null {
  if (!url || isYoutubeUrl(url)) return null;
  const m = url.match(
    /(?:https?:)?\/\/(?:www\.)?(?:player\.)?vimeo\.com\/(?:video\/)?(\d{6,12})\b/i
  );
  return m?.[1] || null;
}

export function parseVimeoEventId(url: string): string | null {
  return url.match(VIMEO_EVENT)?.[1] || null;
}

export function classifyMediaUrl(raw: string): {
  platform: MediaPlatform;
  mediaUrl: string;
  vimeoId?: string;
} | null {
  const url = String(raw || "").trim();
  if (!url || isYoutubeUrl(url)) return null;
  const id = parseVimeoVideoId(url);
  if (id) {
    return { platform: "vimeo", mediaUrl: `https://vimeo.com/${id}`, vimeoId: id };
  }
  try {
    const abs = new URL(url, "https://example.invalid");
    if (abs.protocol.startsWith("http") && DIRECT.test(abs.href)) {
      return { platform: "direct", mediaUrl: abs.href };
    }
  } catch {
    if (DIRECT.test(url)) return { platform: "direct", mediaUrl: url };
  }
  return null;
}

/** Extract Vimeo video IDs + direct media from HTML / text. */
export function extractMediaFromHtml(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  const push = (raw: string) => {
    const c = classifyMediaUrl(raw);
    if (c) out.add(c.mediaUrl);
    else {
      try {
        out.add(new URL(raw, baseUrl).href);
      } catch {
        /* ignore */
      }
    }
  };
  for (const m of html.matchAll(/src=["']([^"']+)["']/gi)) push(m[1]);
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) push(m[1]);
  for (const m of html.matchAll(VIMEO_VIDEO)) push(m[0]);
  for (const m of html.matchAll(
    /https?:\/\/[^\s"'<>]+\.(?:mp4|webm|mov|m4v|m3u8)(?:\?[^\s"'<>]*)?/gi
  )) {
    push(m[0]);
  }
  return [...out].filter((u) => classifyMediaUrl(u));
}

export function extractSittingDetailLinks(html: string, baseUrl: string): string[] {
  const host = (() => {
    try {
      return new URL(baseUrl).hostname;
    } catch {
      return "";
    }
  })();
  const found = new Set<string>();
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const u = new URL(m[1], baseUrl);
      if (u.hostname !== host) continue;
      if (/\/sittings\/detail\//i.test(u.pathname) || /\/sittings\/details\//i.test(u.pathname)) {
        const slug = u.pathname.split("/").filter(Boolean).pop() || "";
        // Skip junk like /sittings/detail/www.parliament.gov.gy
        if (!slug || /\./.test(slug) || slug.length < 4) continue;
        found.add(u.href.split("#")[0]);
      }
    } catch {
      /* ignore */
    }
  }
  return [...found];
}

export function slugifyTitle(title: string, max = 64) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max) || "untitled"
  );
}

export function isVimeoShowcaseUrl(url: string) {
  return VIMEO_SHOWCASE.test(url) || /vimeo\.com\/[^/]+\/videos\/?$/i.test(url);
}

/** Unit-style assertions used by scripts/parl-detect-test.mjs */
export function runDetectSelfTest(): string[] {
  const fails: string[] = [];
  const ok = (name: string, cond: boolean) => {
    if (!cond) fails.push(name);
  };
  ok(
    "vimeo id",
    parseVimeoVideoId("https://player.vimeo.com/video/1198561310?badge=0") === "1198561310"
  );
  ok("vimeo short", parseVimeoVideoId("https://vimeo.com/1217463577") === "1217463577");
  ok("skip youtube", classifyMediaUrl("https://youtube.com/live/abc") === null);
  ok(
    "event id",
    parseVimeoEventId("https://vimeo.com/event/6076062/embed/interaction") === "6076062"
  );
  ok(
    "html extract",
    extractMediaFromHtml(
      `<iframe src="https://player.vimeo.com/video/1213344772"></iframe>`,
      "https://parliament.gov.gy/"
    ).includes("https://vimeo.com/1213344772")
  );
  ok(
    "showcase",
    isVimeoShowcaseUrl("https://vimeo.com/barbadosparliament/videos")
  );
  return fails;
}

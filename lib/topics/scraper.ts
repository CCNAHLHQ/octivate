import { uid, readCollection, writeCollection } from "@/lib/store/json-store";
import { SEED_TRENDS, SEED_MARQUEE } from "@/lib/mock/seed";
import type { MarqueeItem, Trend } from "@/lib/types";

/**
 * Caribbean news / signal feeds. We fetch public RSS where available and
 * gracefully fall back to curated topic heat when a feed is unreachable.
 */
const CARIBBEAN_FEEDS: {
  id: string;
  label: string;
  country: string;
  sector: string;
  url: string;
  kind: MarqueeItem["kind"];
}[] = [
  {
    id: "feed_stabroek",
    label: "Stabroek News",
    country: "Guyana",
    sector: "Politics",
    url: "https://www.stabroeknews.com/feed/",
    kind: "narrative",
  },
  {
    id: "feed_looptt",
    label: "Loop Trinidad",
    country: "Trinidad & Tobago",
    sector: "Politics",
    url: "https://tt.loopnews.com/rss.xml",
    kind: "narrative",
  },
  {
    id: "feed_jamaica_observer",
    label: "Jamaica Observer",
    country: "Jamaica",
    sector: "Politics",
    url: "https://www.jamaicaobserver.com/feed/",
    kind: "narrative",
  },
  {
    id: "feed_nation_barbados",
    label: "NationNews Barbados",
    country: "Barbados",
    sector: "Politics",
    url: "https://www.nationnews.com/feed/",
    kind: "narrative",
  },
];

/** Curated fallback signals when live scrape fails (keeps the workspace honest + useful). */
const FALLBACK_SIGNALS: Omit<Trend, "id">[] = [
  {
    title: "T&T AI governance — UNESCO RAM / national framework",
    country: "Trinidad & Tobago",
    sector: "Artificial Intelligence",
    severity: "high",
    summary:
      "MPAAI is advancing a National AI Governance Framework informed by UNESCO RAM and UNDP AILA; public-service AI procurement and data-protection sequencing are material decision points.",
    publishedAt: new Date().toISOString(),
  },
  {
    title: "Guyana energy — local-content audit pressure",
    country: "Guyana",
    sector: "Energy",
    severity: "high",
    summary:
      "Local-content enforcement and FPSO contractor timelines continue to compress midstream investment windows.",
    publishedAt: new Date().toISOString(),
  },
  {
    title: "Jamaica renewables — grid / IPP procurement watch",
    country: "Jamaica",
    sector: "Energy",
    severity: "medium",
    summary:
      "Utility-scale renewable bankability still hinges on grid interconnection and procurement clarity.",
    publishedAt: new Date().toISOString(),
  },
  {
    title: "Barbados tourism — climate CapEx & insurance",
    country: "Barbados",
    sector: "Tourism",
    severity: "medium",
    summary:
      "Arrivals remain firm while adaptation CapEx and insurance premia reshape hospitality investment cases.",
    publishedAt: new Date().toISOString(),
  },
  {
    title: "CARICOM — food security logistics coordination",
    country: "CARICOM",
    sector: "Policy",
    severity: "low",
    summary:
      "Regional food-security language is advancing; binding agri-logistics instruments remain thin.",
    publishedAt: new Date().toISOString(),
  },
];

function decodeXml(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseRssItems(xml: string, limit = 4): { title: string; summary: string; publishedAt: string }[] {
  const items: { title: string; summary: string; publishedAt: string }[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks.slice(0, limit)) {
    const title = decodeXml((block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim());
    const desc = decodeXml(
      (block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 220)
    );
    const pub =
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ||
      new Date().toISOString();
    if (!title) continue;
    items.push({
      title,
      summary: desc || title,
      publishedAt: Number.isNaN(Date.parse(pub)) ? new Date().toISOString() : new Date(pub).toISOString(),
    });
  }
  return items;
}

async function fetchFeed(url: string, timeoutMs = 8_000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "OctivateTopicScraper/1.0 (+https://octivate.io)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type ScrapeResult = {
  scrapedAt: string;
  feedsTried: number;
  feedsOk: number;
  trendsAdded: number;
  marqueeAdded: number;
  usedFallback: boolean;
  trends: Trend[];
};

/**
 * Scrape Caribbean RSS feeds into trends + marquee. Failures fall back to
 * curated hotspot signals so the workspace never goes blank.
 */
export async function scrapeCaribbeanTopics(): Promise<ScrapeResult> {
  const scrapedAt = new Date().toISOString();
  let feedsOk = 0;
  const freshTrends: Trend[] = [];
  const freshMarquee: MarqueeItem[] = [];

  for (const feed of CARIBBEAN_FEEDS) {
    const xml = await fetchFeed(feed.url);
    if (!xml) continue;
    const items = parseRssItems(xml, 3);
    if (!items.length) continue;
    feedsOk += 1;
    for (const item of items) {
      freshTrends.push({
        id: uid("tr"),
        title: `${feed.country} — ${item.title}`.slice(0, 160),
        country: feed.country,
        sector: feed.sector,
        severity: "medium",
        summary: `${item.summary} (via ${feed.label})`,
        publishedAt: item.publishedAt,
      });
      freshMarquee.push({
        id: uid("mq"),
        badge: feed.country.toUpperCase().slice(0, 12),
        kind: feed.kind,
        text: item.title.slice(0, 140),
        enabled: true,
        sortOrder: freshMarquee.length,
        createdAt: scrapedAt,
      });
    }
  }

  const usedFallback = feedsOk === 0;
  if (usedFallback) {
    for (const fb of FALLBACK_SIGNALS) {
      freshTrends.push({ id: uid("tr"), ...fb });
      freshMarquee.push({
        id: uid("mq"),
        badge: fb.country.toUpperCase().slice(0, 12),
        kind: "narrative",
        text: fb.title.slice(0, 140),
        enabled: true,
        sortOrder: freshMarquee.length,
        createdAt: scrapedAt,
      });
    }
  }

  const existingTrends = await readCollection<Trend>("trends", SEED_TRENDS);
  const mergedTrends = [...freshTrends, ...existingTrends]
    .filter((t, i, arr) => arr.findIndex((x) => x.title === t.title) === i)
    .slice(0, 80);
  await writeCollection("trends", mergedTrends);

  const existingMq = await readCollection<MarqueeItem>("marquee", SEED_MARQUEE);
  const mergedMq = [...freshMarquee, ...existingMq]
    .filter((m, i, arr) => arr.findIndex((x) => x.text === m.text) === i)
    .map((m, i) => ({ ...m, sortOrder: i }))
    .slice(0, 40);
  await writeCollection("marquee", mergedMq);

  return {
    scrapedAt,
    feedsTried: CARIBBEAN_FEEDS.length,
    feedsOk,
    trendsAdded: freshTrends.length,
    marqueeAdded: freshMarquee.length,
    usedFallback,
    trends: freshTrends,
  };
}

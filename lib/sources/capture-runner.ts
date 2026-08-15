import { canLaunchChromium, getChromiumBrowser } from "@/lib/browser/chromium";
import { writeCaptureBundle } from "@/lib/sources/artifacts";
import {
  buildCapturePassport,
  buildCapturePipelineHints,
  buildCaptureRegistry,
} from "@/lib/sources/capture-descriptors";
import { readSourcesCollection } from "@/lib/sources/live-registry";
import { readProbeConfig } from "@/lib/sources/probe-config";
import { assertSafePublicUrl } from "@/lib/security/ssrf";
import type { Source, SourceCaptureQueueItem } from "@/lib/types";

/** Single-page HTML+JSON capture via puppeteer-core (shared Chromium launcher). */
export const CAPTURE_RUNNER_READY = true;

const CAPTURE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OctivateSourceCapture/1.0 (+https://octivate.io; polite-single-page)";

export function isCaptureRunnerAvailable(): boolean {
  return CAPTURE_RUNNER_READY && canLaunchChromium();
}

type PageExtract = {
  title: string;
  text: string;
  links: string[];
  html: string;
  finalUrl: string;
};

async function extractPage(
  url: string,
  timeoutMs: number
): Promise<PageExtract & { statusCode?: number }> {
  const browser = await getChromiumBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(CAPTURE_UA);
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });
    await page.setViewport({ width: 1280, height: 720 });

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    // Give late content a short beat without waiting on full networkidle (WAF sites hang).
    await new Promise((r) => setTimeout(r, 400));

    const extracted = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a[href]"))
        .map((a) => (a as HTMLAnchorElement).href)
        .filter((href) => href.startsWith("http://") || href.startsWith("https://"));
      const uniq = Array.from(new Set(anchors)).slice(0, 120);
      return {
        title: (document.title || "").trim().slice(0, 500),
        text: (document.body?.innerText || "").replace(/\s+\n/g, "\n").trim().slice(0, 500_000),
        links: uniq,
        html: "<!DOCTYPE html>\n" + document.documentElement.outerHTML,
      };
    });

    return {
      ...extracted,
      finalUrl: page.url() || url,
      statusCode: response?.status(),
    };
  } finally {
    await page.close().catch(() => null);
  }
}

async function loadSource(sourceId: string): Promise<Source | null> {
  const sources = await readSourcesCollection();
  return sources.find((s) => s.id === sourceId) || null;
}

/**
 * Capture one queued source page into data/local/source-artifacts/{id}/{ts}/.
 * Bundles include registry/passport descriptors from imported CSVs for pipeline routing.
 */
export async function runSourceCapture(
  item: SourceCaptureQueueItem
): Promise<{ folder: string; routes: string[] }> {
  if (!canLaunchChromium()) {
    throw new Error("chromium_not_found");
  }

  const startedAt = new Date().toISOString();
  const safe = await assertSafePublicUrl(item.url);
  if (!safe.ok) {
    throw new Error(`${safe.code}: ${safe.detail}`);
  }

  const source = await loadSource(item.sourceId);
  const registry = source ? buildCaptureRegistry(source) : undefined;
  const passport = source ? buildCapturePassport(source) : undefined;
  const pipeline = source ? buildCapturePipelineHints(source) : undefined;

  const cfg = await readProbeConfig();
  const timeoutMs = Math.min(45_000, Math.max(8_000, cfg.timeoutMs * 2));

  let extracted: PageExtract & { statusCode?: number };
  try {
    extracted = await extractPage(safe.url.toString(), timeoutMs);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message.slice(0, 280) || "capture_navigation_failed");
  }

  if (extracted.finalUrl && extracted.finalUrl !== safe.url.toString()) {
    const finalSafe = await assertSafePublicUrl(extracted.finalUrl);
    if (!finalSafe.ok) {
      throw new Error(`${finalSafe.code}: redirect target blocked`);
    }
  }

  const statusCode = extracted.statusCode;
  if (statusCode != null && statusCode >= 400) {
    throw new Error(`http_${statusCode}`);
  }

  const { folder } = await writeCaptureBundle({
    sourceId: item.sourceId,
    sourceTitle: item.sourceTitle || source?.title,
    url: extracted.finalUrl || item.url,
    html: extracted.html,
    document: {
      title: extracted.title || item.sourceTitle || source?.title || item.sourceId,
      url: extracted.finalUrl || item.url,
      retrievedAt: new Date().toISOString(),
      text: extracted.text,
      links: extracted.links,
      statusCode,
      contentType: "text/html",
      passport,
    },
    meta: {
      sourceId: item.sourceId,
      sourceTitle: item.sourceTitle || source?.title,
      url: extracted.finalUrl || item.url,
      startedAt,
      status: "ok",
      statusCode,
      contentType: "text/html",
      probe: source
        ? {
            health: source.health,
            healthCheckedAt: source.healthCheckedAt,
          }
        : undefined,
      registry,
      pipeline,
    },
  });

  return { folder, routes: pipeline?.routes || [] };
}

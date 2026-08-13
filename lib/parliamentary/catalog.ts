import { spawn } from "child_process";
import { getChromiumBrowser } from "@/lib/browser/chromium";
import { assertSafePublicUrl } from "@/lib/security/ssrf";
import {
  DEFAULT_SITTING_PART_SEC,
  domainGapMs,
  maxDiscover,
  parlDryRun,
  ytDlpPath,
} from "@/lib/parliamentary/config";
import {
  classifyMediaUrl,
  extractMediaFromHtml,
  extractSittingDetailLinks,
  isVimeoShowcaseUrl,
  parseVimeoEventId,
  parseVimeoVideoId,
} from "@/lib/parliamentary/detect";
import {
  buildQueueSnapshot,
  writeHeartbeat,
} from "@/lib/parliamentary/heartbeat";
import { parlLog } from "@/lib/parliamentary/log";
import {
  ensureJobForCandidate,
  listEnabledSeeds,
  readJobs,
  readPipeline,
  upsertCandidate,
  writeProgress,
} from "@/lib/parliamentary/store";
import { CONNECTOR_VERSION, type CountryCode, type MediaCandidate } from "@/lib/parliamentary/types";
import { uid } from "@/lib/store/json-store";

const lastHit = new Map<string, number>();

async function gap(host: string) {
  const prev = lastHit.get(host) || 0;
  const wait = Math.max(0, domainGapMs() - (Date.now() - prev));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());
}

function run(cmd: string, args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    // Never use shell:true — Windows mangles %(field) templates and tabs.
    const child = spawn(cmd, args, {
      shell: false,
      windowsHide: true,
      env: process.env,
    });
    let out = "";
    let err = "";
    child.stdout?.on("data", (d) => (out += String(d)));
    child.stderr?.on("data", (d) => (err += String(d)));
    child.on("close", (code) => resolve({ code: code ?? 1, out, err }));
    child.on("error", (e) => resolve({ code: 1, out, err: e.message }));
  });
}

async function fetchHtml(url: string) {
  const safe = await assertSafePublicUrl(url);
  if (!safe.ok) throw new Error(`ssrf:${safe.detail || safe.code}`);
  await gap(new URL(url).hostname);
  const browser = await getChromiumBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(
      "OctivateAutomationBot/1.0 (+https://octivate.io; operator media ingest)"
    );
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45_000 });
    await new Promise((r) => setTimeout(r, 1200));
    const html = await page.content();
    const title = await page.title();
    const frames = page
      .frames()
      .map((f) => {
        try {
          return f.url();
        } catch {
          return "";
        }
      })
      .filter((u) => /vimeo/i.test(u));
    return { html: html + frames.map((u) => `<iframe src="${u}">`).join(""), title };
  } finally {
    await page.close().catch(() => undefined);
  }
}

function candidate(opts: {
  country: CountryCode;
  title: string;
  pageUrl: string;
  mediaUrl: string;
  chamber?: string;
  durationSec?: number;
  warnings?: string[];
}): MediaCandidate | null {
  const c = classifyMediaUrl(opts.mediaUrl);
  if (!c) return null;
  return {
    id: uid("parlmed"),
    country: opts.country,
    title: opts.title.slice(0, 220),
    pageUrl: opts.pageUrl,
    mediaUrl: c.mediaUrl,
    platform: c.platform,
    vimeoId: c.vimeoId,
    chamber: opts.chamber,
    discoveredAt: new Date().toISOString(),
    warnings: opts.warnings || [],
    durationSec: opts.durationSec,
    connectorVersion: CONNECTOR_VERSION,
  };
}

/** Barbados: official Vimeo showcase listing (topic = video title). */
async function catalogVimeoShowcase(
  showcaseUrl: string,
  country: CountryCode,
  limit: number
): Promise<MediaCandidate[]> {
  parlLog("info", "catalog showcase start", { showcaseUrl, limit, ytDlp: ytDlpPath() });
  const { code, out, err } = await run(ytDlpPath(), [
    "--flat-playlist",
    "--playlist-end",
    String(limit),
    "--print",
    "%(id)s|||%(title)s|||%(duration)s|||%(webpage_url)s",
    showcaseUrl,
  ]);
  if (code !== 0) {
    parlLog("error", "showcase list failed", {
      code,
      err: err.slice(-1200),
      outHead: out.slice(0, 200),
    });
    throw new Error(`showcase_list_failed`);
  }
  const items: MediaCandidate[] = [];
  for (const line of out.split(/\r?\n/).filter(Boolean)) {
    const [id, title, dur, webpage] = line.split("|||");
    if (!id || !/^\d+$/.test(id.trim())) continue;
    const durationSec = Number(dur);
    const c = candidate({
      country,
      title: (title || `Vimeo ${id}`).trim(),
      pageUrl: showcaseUrl,
      mediaUrl: (webpage || `https://vimeo.com/${id}`).trim(),
      chamber: /senate/i.test(title || "")
        ? "Senate"
        : /house/i.test(title || "")
          ? "House"
          : undefined,
      durationSec: Number.isFinite(durationSec) && durationSec > 0 ? durationSec : undefined,
    });
    if (c) {
      items.push(c);
      parlLog("debug", "showcase item", {
        id: c.vimeoId,
        title: c.title,
        durationSec: c.durationSec ?? null,
      });
    }
  }
  parlLog("info", "catalog showcase done", {
    showcaseUrl,
    parsed: items.length,
    rawLines: out.split(/\r?\n/).filter(Boolean).length,
  });
  return items;
}

async function catalogSitePages(
  seedUrl: string,
  country: CountryCode,
  budget: number
): Promise<MediaCandidate[]> {
  const found: MediaCandidate[] = [];
  const queue = [seedUrl];
  const visited = new Set<string>();

  while (queue.length && visited.size < budget && found.length < budget) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    parlLog("info", "catalog page", { url, country });
    try {
      const { html, title } = await fetchHtml(url);
      const eventId = parseVimeoEventId(html);
      if (eventId) {
        parlLog("info", "live vimeo event", { eventId, url });
      }
      for (const mediaUrl of extractMediaFromHtml(html, url)) {
        const id = parseVimeoVideoId(mediaUrl);
        const c = candidate({
          country,
          title: title || mediaUrl,
          pageUrl: url,
          mediaUrl,
          durationSec: id ? undefined : DEFAULT_SITTING_PART_SEC,
        });
        if (c) found.push(c);
      }
      // Follow sitting detail cards (Guyana pattern)
      if (visited.size < budget) {
        for (const link of extractSittingDetailLinks(html, url).slice(0, 20)) {
          if (!visited.has(link)) queue.push(link);
        }
      }
      // Barbados showcase link from parliament_tv
      if (/barbadosparliament\.com/i.test(url) && /vimeo\.com\/barbadosparliament\/videos/i.test(html)) {
        const more = await catalogVimeoShowcase(
          "https://vimeo.com/barbadosparliament/videos",
          "BB",
          budget - found.length
        );
        found.push(...more);
      }
    } catch (e) {
      parlLog("warn", "catalog page failed", {
        url,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return found;
}

export async function runCatalog(opts?: {
  shouldContinue?: () => Promise<boolean>;
}): Promise<{ candidates: MediaCandidate[]; dryRun: boolean }> {
  const dryRun = parlDryRun();
  const cap = maxDiscover();
  const seeds = await listEnabledSeeds();
  const byUrl = new Map<string, MediaCandidate>();

  await writeProgress({
    stage: "discover",
    total: seeds.length,
    done: 0,
    failed: 0,
    message: `Cataloguing ${seeds.length} source(s)`,
  });

  let i = 0;
  for (const seed of seeds) {
    if (opts?.shouldContinue && !(await opts.shouldContinue())) break;
    i += 1;
    await writeProgress({
      stage: "discover",
      current: seed.url,
      total: seeds.length,
      done: i - 1,
      failed: 0,
      message: seed.label,
    });
    try {
      const [pipeline, jobs] = await Promise.all([readPipeline(), readJobs()]);
      await writeHeartbeat(
        buildQueueSnapshot({
          pipeline,
          jobs,
          found: byUrl.size,
          phase: "discover",
          current: seed.url,
          message: `Cataloguing · ${seed.label} (${i}/${seeds.length})`,
          dryRun,
        })
      );
    } catch {
      /* non-fatal */
    }
    parlLog("info", "catalog seed", {
      index: i,
      total: seeds.length,
      label: seed.label,
      url: seed.url,
      kind: seed.kind,
    });
    try {
      const batch =
        seed.kind === "vimeo_showcase" || isVimeoShowcaseUrl(seed.url)
          ? await catalogVimeoShowcase(seed.url, seed.country, cap)
          : await catalogSitePages(seed.url, seed.country, Math.min(12, cap));
      let added = 0;
      for (const c of batch) {
        if (byUrl.has(c.mediaUrl)) continue;
        byUrl.set(c.mediaUrl, c);
        added += 1;
        try {
          await upsertCandidate(c);
          if (!dryRun) await ensureJobForCandidate(c);
        } catch (persistErr) {
          parlLog("warn", "persist candidate retry", {
            mediaUrl: c.mediaUrl,
            error: persistErr instanceof Error ? persistErr.message : String(persistErr),
          });
          await new Promise((r) => setTimeout(r, 80));
          await upsertCandidate(c);
          if (!dryRun) await ensureJobForCandidate(c);
        }
        parlLog("info", "media queued", {
          title: c.title,
          mediaUrl: c.mediaUrl,
          country: c.country,
          platform: c.platform,
          vimeoId: c.vimeoId ?? null,
          dryRun,
        });
        if (byUrl.size >= cap) break;
      }
      parlLog("info", "seed catalogued", {
        label: seed.label,
        url: seed.url,
        batch: batch.length,
        added,
        totalUnique: byUrl.size,
      });
    } catch (e) {
      parlLog("error", "seed failed", {
        url: seed.url,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    if (byUrl.size >= cap) break;
  }

  await writeProgress({
    stage: "discover",
    done: seeds.length,
    total: seeds.length,
    failed: 0,
    message: `Found ${byUrl.size} media`,
  });
  parlLog("info", "catalog done", {
    found: byUrl.size,
    dryRun,
    jobsWouldQueue: dryRun ? 0 : byUrl.size,
  });
  return { candidates: [...byUrl.values()], dryRun };
}

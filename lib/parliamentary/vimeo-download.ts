/**
 * Vimeo download via player config + ffmpeg HLS (public channel videos).
 * Pattern adapted from open-source approaches such as sam-shubham/vimeo_download
 * (config → HLS/DASH → ffmpeg -c copy). Progressive MP4 used when Vimeo still exposes it.
 *
 * yt-dlp anonymous OAuth is currently broken for Vimeo; Chromium captures the
 * authenticated player /config that the watch page loads, then ffmpeg remuxes.
 */
import { spawn } from "child_process";
import { promises as fs } from "fs";
import { getChromiumBrowser } from "@/lib/browser/chromium";
import { atomicRename } from "@/lib/parliamentary/atomic-json";
import { ffmpegPath } from "@/lib/parliamentary/config";
import { parlLog } from "@/lib/parliamentary/log";

export type VimeoDownloadProgress = {
  bytesDownloaded: number;
  bytesTotal?: number;
  pct: number;
};

type ProgressiveFile = {
  url?: string;
  quality?: string;
  width?: number;
  height?: number;
};

type CdnEntry = {
  url?: string;
  avc_url?: string;
};

type PlayerConfig = {
  video?: { id?: number; title?: string; duration?: number };
  request?: {
    files?: {
      progressive?: ProgressiveFile[];
      hls?: { default_cdn?: string; cdns?: Record<string, CdnEntry> };
      dash?: { default_cdn?: string; cdns?: Record<string, CdnEntry> };
    };
  };
};

export type VimeoStream = {
  kind: "progressive" | "hls";
  url: string;
  quality?: string;
  durationSec?: number;
};

function pickStream(config: PlayerConfig): VimeoStream | null {
  const files = config.request?.files || {};
  const durationSec =
    typeof config.video?.duration === "number" && config.video.duration > 0
      ? config.video.duration
      : undefined;

  const progressive = [...(files.progressive || [])]
    .filter((p) => p.url)
    .sort((a, b) => (b.height || 0) - (a.height || 0));
  if (progressive[0]?.url) {
    return {
      kind: "progressive",
      url: progressive[0].url,
      quality: progressive[0].quality || `${progressive[0].height || "?"}p`,
      durationSec,
    };
  }

  const hls = files.hls?.cdns || {};
  const preferred =
    (files.hls?.default_cdn && hls[files.hls.default_cdn]) ||
    hls.akfire_interconnect_quic ||
    hls.fastly_skyfire ||
    Object.values(hls)[0];
  const hlsUrl = preferred?.avc_url || preferred?.url;
  if (hlsUrl) {
    return { kind: "hls", url: hlsUrl, quality: "hls", durationSec };
  }

  const dash = files.dash?.cdns || {};
  const dashPref =
    (files.dash?.default_cdn && dash[files.dash.default_cdn]) ||
    dash.akfire_interconnect_quic ||
    Object.values(dash)[0];
  const dashUrl = dashPref?.avc_url || dashPref?.url;
  if (dashUrl) {
    // ffmpeg can often ingest Vimeo DASH master JSON/mpd-like URLs when labeled avc_url
    return { kind: "hls", url: dashUrl, quality: "dash", durationSec };
  }
  return null;
}

function parseFfmpegTimeSec(line: string): number | null {
  const m = line.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

async function capturePlayerConfig(vimeoId: string): Promise<PlayerConfig> {
  const watch = `https://vimeo.com/${vimeoId}`;
  const browser = await getChromiumBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const configPromise = page.waitForResponse(
      (res) =>
        /player\.vimeo\.com\/video\/\d+\/config/i.test(res.url()) &&
        res.status() === 200,
      { timeout: 90_000 }
    );

    parlLog("debug", "vimeo open watch", { vimeoId, watch });
    await page.goto(watch, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await new Promise((r) => setTimeout(r, 1200));
    await page.click('button[data-play-button="true"]').catch(async () => {
      const play = await page.$('button[aria-label*="Play"]');
      if (play) await play.click();
      else await page.mouse.click(700, 400);
    });

    const res = await configPromise;
    const config = (await res.json()) as PlayerConfig;
    parlLog("info", "vimeo player config captured", {
      vimeoId,
      durationSec: config.video?.duration ?? null,
      hasProgressive: Boolean(config.request?.files?.progressive?.length),
      hlsCdns: Object.keys(config.request?.files?.hls?.cdns || {}),
      configUrl: res.url().slice(0, 140),
    });
    return config;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    parlLog("error", "vimeo player config failed", { vimeoId, error: msg.slice(0, 300) });
    throw new Error(`vimeo_config_not_found:${msg.slice(0, 180)}`);
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function ffmpegStreamDownload(opts: {
  streamUrl: string;
  dest: string;
  referer: string;
  durationSec?: number;
  onProgress?: (p: VimeoDownloadProgress) => void;
}) {
  const bin = ffmpegPath();
  if (!bin) throw new Error("ffmpeg_missing");
  const partial = `${opts.dest}.partial.mp4`;
  await fs.unlink(partial).catch(() => undefined);
  await fs.unlink(opts.dest).catch(() => undefined);

  const args = [
    "-y",
    "-user_agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "-headers",
    `Referer: ${opts.referer}\r\n`,
    "-i",
    opts.streamUrl,
    "-c",
    "copy",
    "-bsf:a",
    "aac_adtstoasc",
    "-movflags",
    "+faststart",
    partial,
  ];

  parlLog("info", "vimeo ffmpeg stream start", {
    dest: opts.dest.split(/[/\\]/).pop(),
    durationSec: opts.durationSec ?? null,
  });
  opts.onProgress?.({ bytesDownloaded: 0, pct: 2 });

  await new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let err = "";
    let lastEmit = 0;
    child.stderr?.on("data", (d) => {
      const s = String(d);
      err += s;
      if (err.length > 12_000) err = err.slice(-8_000);
      const t = parseFfmpegTimeSec(s);
      if (t == null) return;
      const now = Date.now();
      if (now - lastEmit < 400) return;
      lastEmit = now;
      const dur = opts.durationSec && opts.durationSec > 0 ? opts.durationSec : 0;
      const pct = dur
        ? Math.max(2, Math.min(99, Math.round((t / dur) * 100)))
        : Math.min(95, 2 + Math.round(t / 30));
      opts.onProgress?.({
        bytesDownloaded: Math.round(t * 250_000),
        bytesTotal: dur ? Math.round(dur * 250_000) : undefined,
        pct,
      });
    });
    child.on("error", (e) => reject(new Error(`ffmpeg_spawn:${e.message}`)));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg_hls_failed:${err.slice(-500)}`));
    });
  });

  await atomicRename(partial, opts.dest);
  const st = await fs.stat(opts.dest);
  opts.onProgress?.({
    bytesDownloaded: st.size,
    bytesTotal: st.size,
    pct: 100,
  });
  parlLog("info", "vimeo ffmpeg stream done", { bytes: st.size });
  return { bytes: st.size };
}

/**
 * Download a public Vimeo video to destAbs (mp4).
 * Uses Chromium to obtain player config, then progressive HTTP or ffmpeg HLS.
 */
export async function downloadVimeoToFile(
  vimeoId: string,
  destAbs: string,
  opts?: {
    onProgress?: (p: VimeoDownloadProgress) => void;
    httpDownload?: (
      url: string,
      dest: string,
      referer?: string,
      onProgress?: (p: VimeoDownloadProgress) => void
    ) => Promise<{ bytes: number; expectBytes?: number }>;
  }
): Promise<{ bytes: number; expectBytes?: number; durationSec?: number; method: string }> {
  const id = vimeoId.replace(/\D/g, "");
  if (!id) throw new Error("missing_vimeo_id");
  const watch = `https://vimeo.com/${id}`;

  const config = await capturePlayerConfig(id);
  const stream = pickStream(config);
  if (!stream) throw new Error("vimeo_stream_not_found");

  parlLog("info", "vimeo stream selected", {
    vimeoId: id,
    kind: stream.kind,
    quality: stream.quality || null,
    durationSec: stream.durationSec ?? null,
    url: stream.url.slice(0, 120),
  });

  if (stream.kind === "progressive" && opts?.httpDownload) {
    opts.onProgress?.({ bytesDownloaded: 0, pct: 3 });
    const transfer = await opts.httpDownload(stream.url, destAbs, watch, opts.onProgress);
    return {
      ...transfer,
      durationSec: stream.durationSec,
      method: `progressive:${stream.quality || "mp4"}`,
    };
  }

  const transfer = await ffmpegStreamDownload({
    streamUrl: stream.url,
    dest: destAbs,
    referer: watch,
    durationSec: stream.durationSec,
    onProgress: opts?.onProgress,
  });
  return {
    ...transfer,
    expectBytes: transfer.bytes,
    durationSec: stream.durationSec,
    method: stream.quality === "dash" ? "dash-ffmpeg" : "hls-ffmpeg",
  };
}

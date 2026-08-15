import { createHash } from "crypto";
import { createWriteStream, promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { assertSafePublicUrl } from "@/lib/security/ssrf";
import { ffmpegPath } from "@/lib/parliamentary/config";
import { parlLog } from "@/lib/parliamentary/log";
import { buildArtifactFolder, relativeToCwd } from "@/lib/parliamentary/paths";
import { CONNECTOR_VERSION, type MediaJob, type MediaMetaFile } from "@/lib/parliamentary/types";
import { parseVimeoVideoId } from "@/lib/parliamentary/detect";
import { downloadVimeoToFile } from "@/lib/parliamentary/vimeo-download";

/** Reject tiny/corrupt captures before ASR. */
const MIN_VIDEO_BYTES = 256 * 1024;

async function hashFile(filePath: string) {
  const hash = createHash("sha256");
  const fh = await fs.open(filePath, "r");
  try {
    for await (const chunk of fh.createReadStream()) hash.update(chunk as Buffer);
  } finally {
    await fh.close();
  }
  return hash.digest("hex");
}

function probeDurationSec(videoAbs: string): Promise<number | null> {
  const bin = ffmpegPath();
  if (!bin) return Promise.resolve(null);
  return new Promise((resolve) => {
    const child = spawn(
      bin,
      ["-hide_banner", "-i", videoAbs, "-f", "null", "-"],
      { windowsHide: true }
    );
    let err = "";
    child.stderr?.on("data", (d) => {
      err += String(d);
    });
    child.on("close", () => {
      const m = err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!m) {
        resolve(null);
        return;
      }
      const sec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
      resolve(Number.isFinite(sec) && sec > 0 ? sec : null);
    });
    child.on("error", () => resolve(null));
  });
}

export type VideoReadyInfo = {
  bytes: number;
  contentHash: string;
  durationSec?: number;
};

/**
 * Hard gate: file must exist, not be a partial, meet size, and preferably probe as media.
 */
export async function assertVideoReady(
  videoAbs: string,
  opts?: { expectBytes?: number; minBytes?: number }
): Promise<VideoReadyInfo> {
  const minBytes = opts?.minBytes ?? MIN_VIDEO_BYTES;
  const partial = `${videoAbs}.partial`;
  try {
    await fs.access(partial);
    throw new Error("download_incomplete:partial_still_present");
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("download_incomplete")) throw e;
    // ENOENT = no partial left — good
  }

  let st: Awaited<ReturnType<typeof fs.stat>>;
  try {
    st = await fs.stat(videoAbs);
  } catch {
    throw new Error("download_incomplete:missing_video");
  }
  if (!st.isFile()) throw new Error("download_incomplete:not_a_file");
  if (st.size < minBytes) {
    throw new Error(`download_incomplete:too_small:${st.size}`);
  }
  if (opts?.expectBytes != null && opts.expectBytes > 0) {
    // Allow tiny HTTP trailer slack only.
    if (st.size < opts.expectBytes * 0.985) {
      throw new Error(
        `download_incomplete:size_mismatch:got=${st.size}:expect=${opts.expectBytes}`
      );
    }
  }

  const contentHash = await hashFile(videoAbs);
  const durationSec = (await probeDurationSec(videoAbs)) ?? undefined;
  if (durationSec != null && durationSec < 5) {
    throw new Error(`download_incomplete:duration_too_short:${durationSec}`);
  }

  // ffmpeg missing is OK; size gate already applied. When present, require a parseable container.
  if (ffmpegPath() && durationSec == null) {
    throw new Error("download_incomplete:unreadable_media");
  }

  return { bytes: st.size, contentHash, durationSec };
}

export type DownloadProgress = {
  bytesDownloaded: number;
  bytesTotal?: number;
  pct: number;
};

async function httpDownload(
  url: string,
  dest: string,
  referer?: string,
  onProgress?: (p: DownloadProgress) => void
): Promise<{ bytes: number; expectBytes?: number }> {
  const safe = await assertSafePublicUrl(url);
  if (!safe.ok) throw new Error(`ssrf:${safe.detail || safe.code}`);
  const partial = `${dest}.partial`;
  await fs.unlink(partial).catch(() => undefined);
  await fs.unlink(dest).catch(() => undefined);

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      ...(referer ? { Referer: referer } : {}),
    },
    redirect: "follow",
  });
  if (!res.ok || !res.body) throw new Error(`http_${res.status}`);

  const cl = Number(res.headers.get("content-length") || 0);
  const expectBytes = Number.isFinite(cl) && cl > 0 ? cl : undefined;
  const reader = res.body.getReader();
  const ws = createWriteStream(partial);
  let downloaded = 0;
  let lastEmit = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      downloaded += value.byteLength;
      await new Promise<void>((resolve, reject) => {
        ws.write(Buffer.from(value), (err) => (err ? reject(err) : resolve()));
      });
      const now = Date.now();
      if (now - lastEmit > 400 || (expectBytes && downloaded >= expectBytes)) {
        lastEmit = now;
        const pct = expectBytes
          ? Math.min(99, Math.round((downloaded / expectBytes) * 100))
          : Math.min(95, Math.round(downloaded / (1024 * 1024)));
        onProgress?.({ bytesDownloaded: downloaded, bytesTotal: expectBytes, pct });
      }
    }
    await new Promise<void>((resolve, reject) =>
      ws.end((err: Error | null | undefined) => (err ? reject(err) : resolve()))
    );
  } catch (e) {
    ws.destroy();
    await fs.unlink(partial).catch(() => undefined);
    throw e;
  }

  const st = await fs.stat(partial);
  if (st.size < MIN_VIDEO_BYTES) {
    await fs.unlink(partial).catch(() => undefined);
    throw new Error(`download_incomplete:partial_too_small:${st.size}`);
  }
  if (expectBytes != null && st.size < expectBytes * 0.985) {
    await fs.unlink(partial).catch(() => undefined);
    throw new Error(
      `download_incomplete:truncated:got=${st.size}:expect=${expectBytes}`
    );
  }

  await fs.rename(partial, dest);
  onProgress?.({ bytesDownloaded: st.size, bytesTotal: expectBytes ?? st.size, pct: 100 });
  parlLog("info", "http download verified", {
    bytes: st.size,
    expectBytes: expectBytes ?? null,
  });
  return { bytes: st.size, expectBytes };
}


export async function downloadMediaJob(
  job: MediaJob,
  opts?: { onProgress?: (p: DownloadProgress) => void }
) {
  const folderAbs = buildArtifactFolder(job.country, job.title);
  await fs.mkdir(folderAbs, { recursive: true });
  const folder = relativeToCwd(folderAbs);
  const videoAbs = path.join(folderAbs, "video.mp4");

  parlLog("info", "download start", { id: job.id, mediaUrl: job.mediaUrl, folder });

  let transfer: { bytes: number; expectBytes?: number; durationSec?: number };
  if (job.platform === "vimeo") {
    const id = job.vimeoId || parseVimeoVideoId(job.mediaUrl);
    if (!id) throw new Error("missing_vimeo_id");
    const vimeo = await downloadVimeoToFile(id, videoAbs, {
      onProgress: opts?.onProgress,
      httpDownload,
    });
    parlLog("info", "vimeo download method", {
      id: job.id,
      method: vimeo.method,
      bytes: vimeo.bytes,
    });
    transfer = vimeo;
  } else {
    transfer = await httpDownload(job.mediaUrl, videoAbs, job.pageUrl, opts?.onProgress);
  }

  // Final gate — ASR must never see an unfinished file.
  const ready = await assertVideoReady(videoAbs, {
    expectBytes: transfer.expectBytes,
  });

  const meta: MediaMetaFile = {
    mediaId: job.id,
    title: job.title,
    country: job.country,
    platform: job.platform,
    pageUrl: job.pageUrl,
    mediaUrl: job.mediaUrl,
    folder,
    videoFile: "video.mp4",
    contentHash: ready.contentHash,
    discoveredAt: job.createdAt,
    downloadedAt: new Date().toISOString(),
    transcriptStatus: "not_applicable",
    connectorVersion: CONNECTOR_VERSION,
    warnings: [...job.warnings],
    durationSec: ready.durationSec,
  };
  await fs.writeFile(path.join(folderAbs, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
  // Marker that download phase completed (ASR checks this too).
  await fs.writeFile(
    path.join(folderAbs, "download.ok"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        bytes: ready.bytes,
        contentHash: ready.contentHash,
        durationSec: ready.durationSec ?? null,
        expectBytes: transfer.expectBytes ?? null,
      },
      null,
      2
    ),
    "utf8"
  );

  parlLog("info", "download done", {
    id: job.id,
    bytes: ready.bytes,
    contentHash: ready.contentHash,
    durationSec: ready.durationSec ?? null,
  });
  return {
    folder,
    videoPath: relativeToCwd(videoAbs),
    meta,
    bytes: ready.bytes,
    durationSec: ready.durationSec,
  };
}

export async function cleanupPartial(folderRel?: string) {
  if (!folderRel) return;
  const abs = path.isAbsolute(folderRel) ? folderRel : path.join(process.cwd(), folderRel);
  try {
    for (const f of await fs.readdir(abs)) {
      if (f.endsWith(".partial") || f === "download.ok") {
        await fs.unlink(path.join(abs, f)).catch(() => undefined);
      }
    }
  } catch {
    /* ignore */
  }
}

export type { MediaMetaFile };

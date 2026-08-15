import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { ffmpegPath } from "@/lib/parliamentary/config";
import { parlLog } from "@/lib/parliamentary/log";

/** Extract compressed mono mp3 for STT (much smaller than source video). */
export async function extractAudioMp3(
  videoAbs: string,
  outAbs: string,
  onProgress?: (pct: number) => void
): Promise<{ path: string; bytes: number }> {
  const bin = ffmpegPath();
  if (!bin) throw new Error("ffmpeg_missing");
  await fs.mkdir(path.dirname(outAbs), { recursive: true });
  await fs.unlink(outAbs).catch(() => undefined);

  parlLog("info", "audio extract start", {
    video: path.basename(videoAbs),
    out: path.basename(outAbs),
  });

  await new Promise<void>((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      videoAbs,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "48k",
      outAbs,
    ];
    const child = spawn(bin, args, { windowsHide: true });
    let err = "";
    let lastPct = 0;
    child.stderr?.on("data", (d) => {
      const s = String(d);
      err += s;
      // ffmpeg time=HH:MM:SS.xx progress (duration unknown → soft pulse)
      if (/time=/.test(s)) {
        lastPct = Math.min(95, lastPct + 2);
        onProgress?.(lastPct);
      }
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg_extract_failed:${err.slice(-400)}`));
    });
    child.on("error", (e) => reject(e));
  });

  const st = await fs.stat(outAbs);
  if (st.size < 1024) throw new Error("audio_extract_too_small");
  onProgress?.(100);
  parlLog("info", "audio extract done", { bytes: st.size });
  return { path: outAbs, bytes: st.size };
}

/** Split audio into ~N-second chunks under OpenRouter size limits. */
export async function splitAudioChunks(
  audioAbs: string,
  outDir: string,
  chunkSec = 480
): Promise<string[]> {
  const bin = ffmpegPath();
  if (!bin) throw new Error("ffmpeg_missing");
  await fs.mkdir(outDir, { recursive: true });
  const pattern = path.join(outDir, "chunk_%03d.mp3");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      bin,
      [
        "-y",
        "-i",
        audioAbs,
        "-f",
        "segment",
        "-segment_time",
        String(chunkSec),
        "-c",
        "copy",
        pattern,
      ],
      { windowsHide: true }
    );
    let err = "";
    child.stderr?.on("data", (d) => {
      err += String(d);
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg_split_failed:${err.slice(-300)}`));
    });
    child.on("error", (e) => reject(e));
  });
  const files = (await fs.readdir(outDir))
    .filter((f) => /^chunk_\d+\.mp3$/i.test(f))
    .sort()
    .map((f) => path.join(outDir, f));
  if (!files.length) throw new Error("audio_split_empty");
  parlLog("info", "audio split", { chunks: files.length, chunkSec });
  return files;
}

import { existsSync } from "fs";
import os from "os";
export { VERIFIED_SOURCES as DEFAULT_SOURCES, SOURCES_REV } from "@/lib/parliamentary/sources";

export function parlEnabled() {
  return String(process.env.PARL_MEDIA_ENABLED || "true").toLowerCase() !== "false";
}
export function parlDryRun() {
  // Explicit opt-in only. Do not treat leftover shell "true" from older sessions.
  const v = String(process.env.PARL_MEDIA_DRY_RUN ?? "0").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
export function maxDiscover() {
  const n = Number(process.env.PARL_MEDIA_MAX_DISCOVER || 40);
  return Number.isFinite(n) ? Math.max(1, Math.min(200, Math.floor(n))) : 40;
}
export function batchDefault() {
  const n = Number(process.env.PARL_BATCH_DEFAULT || 5);
  return Number.isFinite(n) ? Math.max(1, Math.min(batchHardCap(), Math.floor(n))) : 5;
}
export function batchHardCap() {
  const n = Number(process.env.PARL_BATCH_HARD_CAP || 50);
  return Number.isFinite(n) ? Math.max(1, Math.min(200, Math.floor(n))) : 50;
}
export function maxRetriesDefault() {
  const n = Number(process.env.PARL_ASR_MAX_RETRIES || 3);
  return Number.isFinite(n) ? Math.max(0, Math.min(8, Math.floor(n))) : 3;
}
export function asrProviderDefault(): "auto" | "openrouter" | "local" {
  const v = String(process.env.PARL_ASR_PROVIDER || "auto").trim().toLowerCase();
  if (v === "openrouter" || v === "local" || v === "auto") return v;
  return "auto";
}
export function openRouterSttModel() {
  return (
    process.env.PARL_OPENROUTER_STT_MODEL?.trim() ||
    "openai/whisper-1"
  );
}
export function asrConcurrency() {
  const cores = Math.max(1, os.cpus()?.length || 2);
  const def = Math.max(1, cores - 1);
  const n = Number(process.env.PARL_ASR_CONCURRENCY || def);
  return Number.isFinite(n) ? Math.max(1, Math.min(cores, Math.floor(n))) : def;
}
export function whisperModel() {
  return process.env.PARL_WHISPER_MODEL?.trim() || "base";
}
export function domainGapMs() {
  const n = Number(process.env.PARL_DOMAIN_GAP_MS || 1000);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 1000;
}
export function ytDlpPath() {
  const env = process.env.YT_DLP_PATH?.trim();
  if (env) return env;
  for (const c of [
    "C:/Python314/Scripts/yt-dlp.exe",
    "C:/Python313/Scripts/yt-dlp.exe",
  ]) {
    if (existsSync(c)) return c;
  }
  return "yt-dlp";
}
export function pythonPath() {
  const env = process.env.PARL_PYTHON?.trim();
  if (env) return env;
  for (const c of ["C:/Python314/python.exe", "C:/Python313/python.exe"]) {
    if (existsSync(c)) return c;
  }
  return process.platform === "win32" ? "py" : "python";
}
export function ffmpegPath(): string | null {
  const env = process.env.FFMPEG_PATH?.trim();
  if (env && existsSync(env)) return env;
  const bundled =
    "C:/Python314/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe";
  return existsSync(bundled) ? bundled : null;
}

/** Observed faster-whisper realtime factors (video-seconds / wall-seconds). Higher = faster. */
export function whisperRealtimeFactor(model = whisperModel()): number {
  const m = model.toLowerCase();
  if (m.includes("tiny")) return 8;
  if (m.includes("small")) return 3;
  if (m.includes("medium")) return 1.4;
  if (m.includes("large")) return 0.7;
  return 4; // base
}

/** Fallback duration when Vimeo omits length (typical sitting part). */
export const DEFAULT_SITTING_PART_SEC = 90 * 60;

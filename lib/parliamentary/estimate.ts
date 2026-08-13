import {
  DEFAULT_SITTING_PART_SEC,
  whisperModel,
  whisperRealtimeFactor,
} from "@/lib/parliamentary/config";

/** Wall-clock ASR estimate from video duration + model realtime factor. */
export function estimateAsrSeconds(durationSec?: number, model = whisperModel()): number {
  const dur = durationSec && durationSec > 0 ? durationSec : DEFAULT_SITTING_PART_SEC;
  const rtf = Math.max(0.2, whisperRealtimeFactor(model));
  return Math.max(30, Math.round(dur / rtf));
}

export function formatEta(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

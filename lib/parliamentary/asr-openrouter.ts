import { promises as fs } from "fs";
import path from "path";
import { openRouterSttModel } from "@/lib/parliamentary/config";
import { parlLog } from "@/lib/parliamentary/log";
import { splitAudioChunks } from "@/lib/parliamentary/audio";

const OR_URL = "https://openrouter.ai/api/v1/audio/transcriptions";
/** Stay under OpenRouter multipart ~25MB limit with margin. */
const MAX_UPLOAD_BYTES = 18 * 1024 * 1024;

type OrSegment = { start?: number; end?: number; text?: string };

export type OpenRouterAsrResult = {
  text: string;
  language?: string;
  durationSec?: number;
  model: string;
  segments: { start: number; end: number; text: string }[];
  provider: "openrouter";
};

async function transcribeFile(
  fileAbs: string,
  opts: { model: string; apiKey: string; language?: string }
): Promise<{ text: string; language?: string; durationSec?: number; segments: OrSegment[] }> {
  const buf = await fs.readFile(fileAbs);
  const b64 = buf.toString("base64");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);
  try {
    const res = await fetch(OR_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || "https://octivate.io",
        "X-Title": process.env.OPENROUTER_APP_TITLE || "Octivate Automation",
      },
      body: JSON.stringify({
        model: opts.model,
        language: opts.language || "en",
        response_format: "verbose_json",
        input_audio: {
          data: b64,
          format: "mp3",
        },
      }),
      signal: controller.signal,
    });
    const raw = await res.text();
    let body: {
      text?: string;
      language?: string;
      duration?: number;
      segments?: OrSegment[];
      error?: { message?: string };
    };
    try {
      body = JSON.parse(raw) as typeof body;
    } catch {
      throw new Error(`openrouter_stt_bad_json:${res.status}:${raw.slice(0, 200)}`);
    }
    if (!res.ok) {
      throw new Error(
        `openrouter_stt_${res.status}:${body.error?.message || raw.slice(0, 240)}`
      );
    }
    return {
      text: body.text || "",
      language: body.language,
      durationSec: body.duration,
      segments: body.segments || [],
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function transcribeViaOpenRouter(opts: {
  audioAbs: string;
  workDir: string;
  onProgress?: (pct: number, label: string) => void;
}): Promise<OpenRouterAsrResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("openrouter_key_missing");
  const model = openRouterSttModel();
  const st = await fs.stat(opts.audioAbs);
  parlLog("info", "openrouter stt start", {
    model,
    bytes: st.size,
  });

  let files = [opts.audioAbs];
  if (st.size > MAX_UPLOAD_BYTES) {
    opts.onProgress?.(5, "Splitting audio for OpenRouter…");
    const chunkDir = path.join(opts.workDir, "asr-chunks");
    await fs.rm(chunkDir, { recursive: true, force: true }).catch(() => undefined);
    files = await splitAudioChunks(opts.audioAbs, chunkDir, 420);
  }

  const texts: string[] = [];
  const segments: { start: number; end: number; text: string }[] = [];
  let language: string | undefined;
  let durationSec = 0;
  let offset = 0;

  for (let i = 0; i < files.length; i++) {
    const pct = Math.round(((i + 0.2) / files.length) * 100);
    opts.onProgress?.(pct, `OpenRouter STT chunk ${i + 1}/${files.length}`);
    parlLog("debug", "openrouter stt chunk", {
      index: i + 1,
      total: files.length,
      file: path.basename(files[i]),
    });
    const part = await transcribeFile(files[i], { model, apiKey, language: "en" });
    texts.push(part.text.trim());
    language = part.language || language;
    for (const s of part.segments) {
      segments.push({
        start: Number(s.start || 0) + offset,
        end: Number(s.end || 0) + offset,
        text: (s.text || "").trim(),
      });
    }
    offset += Number(part.durationSec || 0);
    durationSec += Number(part.durationSec || 0);
    opts.onProgress?.(
      Math.round(((i + 1) / files.length) * 100),
      `OpenRouter STT chunk ${i + 1}/${files.length} done`
    );
  }

  const text = texts.filter(Boolean).join("\n").trim();
  if (!text) throw new Error("openrouter_stt_empty");
  parlLog("info", "openrouter stt done", {
    model,
    chars: text.length,
    chunks: files.length,
    durationSec: durationSec || null,
  });
  return {
    text,
    language,
    durationSec: durationSec || undefined,
    model,
    segments,
    provider: "openrouter",
  };
}

export function isRetryableAsrError(msg: string) {
  return /openrouter_stt_(429|500|502|503|504)|timed?\s*out|ECONNRESET|fetch failed|abort/i.test(
    msg
  );
}

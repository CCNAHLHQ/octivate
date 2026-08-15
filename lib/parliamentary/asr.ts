import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { extractAudioMp3 } from "@/lib/parliamentary/audio";
import {
  isRetryableAsrError,
  transcribeViaOpenRouter,
} from "@/lib/parliamentary/asr-openrouter";
import { asrProviderDefault, pythonPath, whisperModel } from "@/lib/parliamentary/config";
import { assertVideoReady } from "@/lib/parliamentary/download";
import { estimateAsrSeconds } from "@/lib/parliamentary/estimate";
import { parlLog } from "@/lib/parliamentary/log";
import { readSettings } from "@/lib/parliamentary/settings";
import type { MediaJob } from "@/lib/parliamentary/types";
import { relativeToCwd } from "@/lib/parliamentary/paths";

function runPython(script: string, args: string[]) {
  return new Promise<{ code: number; stderr: string }>((resolve) => {
    const child = spawn(pythonPath(), [script, ...args], {
      cwd: process.cwd(),
      env: process.env,
      shell: process.platform === "win32",
    });
    let stderr = "";
    child.stdout?.on("data", (d) => process.stdout.write(String(d)));
    child.stderr?.on("data", (d) => {
      const s = String(d);
      stderr += s;
      process.stderr.write(s);
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
    child.on("error", (e) => resolve({ code: 1, stderr: e.message }));
  });
}

function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function writeTranscriptArtifacts(opts: {
  job: MediaJob;
  folderAbs: string;
  text: string;
  language?: string;
  durationSec?: number;
  model: string;
  provider: "openrouter" | "local";
  segments: { start: number; end: number; text: string }[];
  startedAt: string;
}) {
  const finishedAt = new Date().toISOString();
  const headers = [
    "media_id",
    "title",
    "country",
    "platform",
    "source_page_url",
    "media_url",
    "folder",
    "duration_sec",
    "transcript_status",
    "model",
    "provider",
    "language",
    "started_at",
    "finished_at",
    "text",
    "segment_start",
    "segment_end",
  ];
  const rows = [
    {
      media_id: opts.job.id,
      title: opts.job.title,
      country: opts.job.country,
      platform: opts.job.platform,
      source_page_url: opts.job.pageUrl,
      media_url: opts.job.mediaUrl,
      folder: opts.job.folder,
      duration_sec: opts.durationSec,
      transcript_status: "octivate_machine_transcript",
      model: opts.model,
      provider: opts.provider,
      language: opts.language,
      started_at: opts.startedAt,
      finished_at: finishedAt,
      text: opts.text.trim(),
      segment_start: "",
      segment_end: "",
    },
    ...opts.segments.map((s) => ({
      media_id: opts.job.id,
      title: opts.job.title,
      country: opts.job.country,
      platform: opts.job.platform,
      source_page_url: opts.job.pageUrl,
      media_url: opts.job.mediaUrl,
      folder: opts.job.folder,
      duration_sec: opts.durationSec,
      transcript_status: "octivate_machine_transcript",
      model: opts.model,
      provider: opts.provider,
      language: opts.language,
      started_at: opts.startedAt,
      finished_at: finishedAt,
      text: s.text,
      segment_start: s.start,
      segment_end: s.end,
    })),
  ];
  await fs.writeFile(
    path.join(opts.folderAbs, "transcripts.csv"),
    `${headers.join(",")}\n${rows
      .map((r) => headers.map((h) => csvEscape((r as Record<string, unknown>)[h])).join(","))
      .join("\n")}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(opts.folderAbs, "transcript.jsonl"),
    [
      JSON.stringify({
        type: "summary",
        text: opts.text.trim(),
        language: opts.language,
        duration_sec: opts.durationSec,
        model: opts.model,
        provider: opts.provider,
      }),
      ...opts.segments.map((s) =>
        JSON.stringify({ type: "segment", start: s.start, end: s.end, text: s.text })
      ),
    ].join("\n") + "\n",
    "utf8"
  );
  try {
    const metaPath = path.join(opts.folderAbs, "meta.json");
    const meta = JSON.parse(await fs.readFile(metaPath, "utf8")) as Record<string, unknown>;
    meta.transcribedAt = finishedAt;
    meta.transcriptStatus = "octivate_machine_transcript";
    meta.model = opts.model;
    meta.asrProvider = opts.provider;
    meta.durationSec = opts.durationSec;
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
  } catch {
    /* optional */
  }
}

async function transcribeLocal(
  job: MediaJob,
  folderAbs: string,
  videoAbs: string,
  onProgress?: (pct: number, label: string) => void
) {
  const model = whisperModel();
  const script = path.join(process.cwd(), "tools", "parl-asr", "transcribe_worker.py");
  const outJsonl = path.join(folderAbs, "transcript.jsonl");
  const jobJson = path.join(folderAbs, "asr-job.json");
  await fs.writeFile(
    jobJson,
    JSON.stringify(
      {
        media_id: job.id,
        title: job.title,
        country: job.country,
        platform: job.platform,
        source_page_url: job.pageUrl,
        media_url: job.mediaUrl,
        folder: job.folder,
        video_path: videoAbs,
        model,
        out_jsonl: outJsonl,
      },
      null,
      2
    ),
    "utf8"
  );
  onProgress?.(10, "Local faster-whisper…");
  parlLog("info", "local asr start", {
    id: job.id,
    model,
    etaSec: estimateAsrSeconds(job.durationSec, model),
  });
  const result = await runPython(script, ["--job", jobJson]);
  if (result.code !== 0) throw new Error(`asr_failed:${result.stderr.slice(0, 500)}`);
  onProgress?.(95, "Local ASR finalize…");

  let text = "";
  let language: string | undefined;
  let durationSec = job.durationSec;
  const segments: { start: number; end: number; text: string }[] = [];
  for (const line of (await fs.readFile(outJsonl, "utf8")).split(/\r?\n/).filter(Boolean)) {
    const row = JSON.parse(line) as {
      type?: string;
      text?: string;
      language?: string;
      duration_sec?: number;
      start?: number;
      end?: number;
    };
    if (row.type === "summary") {
      text = row.text || text;
      language = row.language;
      if (row.duration_sec) durationSec = row.duration_sec;
    } else if (row.type === "segment") {
      segments.push({
        start: Number(row.start || 0),
        end: Number(row.end || 0),
        text: row.text || "",
      });
    }
  }
  return {
    text: text.trim(),
    language,
    durationSec,
    model,
    segments,
    provider: "local" as const,
  };
}

export async function transcribeMediaJob(
  job: MediaJob,
  opts?: {
    onProgress?: (pct: number, label: string, phase?: "extract" | "asr" | "finalize") => void;
  }
) {
  if (!job.folder || !job.videoPath) throw new Error("missing_video_paths");
  const folderAbs = path.isAbsolute(job.folder)
    ? job.folder
    : path.join(process.cwd(), job.folder);
  const videoAbs = path.isAbsolute(job.videoPath)
    ? job.videoPath
    : path.join(process.cwd(), job.videoPath);

  try {
    await fs.access(path.join(folderAbs, "download.ok"));
  } catch {
    throw new Error("download_incomplete:missing_download_ok");
  }
  const ready = await assertVideoReady(videoAbs);
  parlLog("info", "asr preflight ok", {
    id: job.id,
    bytes: ready.bytes,
    durationSec: ready.durationSec ?? null,
  });

  const settings = await readSettings().catch(() => ({
    asrProvider: asrProviderDefault(),
  }));
  const prefer =
    settings.asrProvider || asrProviderDefault();
  const startedAt = new Date().toISOString();

  opts?.onProgress?.(2, "Extracting audio…", "extract");
  const audioAbs = path.join(folderAbs, "audio.mp3");
  await extractAudioMp3(videoAbs, audioAbs, (p) =>
    opts?.onProgress?.(Math.round(p * 0.15), "Extracting audio…", "extract")
  );

  let result:
    | Awaited<ReturnType<typeof transcribeViaOpenRouter>>
    | Awaited<ReturnType<typeof transcribeLocal>>;
  const tryOpenRouter = prefer === "auto" || prefer === "openrouter";
  const tryLocal = prefer === "auto" || prefer === "local";

  if (tryOpenRouter) {
    try {
      opts?.onProgress?.(18, "OpenRouter STT…", "asr");
      result = await transcribeViaOpenRouter({
        audioAbs,
        workDir: folderAbs,
        onProgress: (p, label) =>
          opts?.onProgress?.(18 + Math.round(p * 0.72), label, "asr"),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      parlLog("warn", "openrouter stt failed", {
        id: job.id,
        error: msg.slice(0, 300),
        fallback: tryLocal,
        retryable: isRetryableAsrError(msg),
      });
      if (!tryLocal) throw err;
      opts?.onProgress?.(20, "Falling back to local ASR…", "asr");
      result = await transcribeLocal(job, folderAbs, videoAbs, (p, label) =>
        opts?.onProgress?.(20 + Math.round(p * 0.7), label, "asr")
      );
    }
  } else {
    result = await transcribeLocal(job, folderAbs, videoAbs, (p, label) =>
      opts?.onProgress?.(20 + Math.round(p * 0.7), label, "asr")
    );
  }

  opts?.onProgress?.(94, "Writing transcripts…", "finalize");
  await writeTranscriptArtifacts({
    job,
    folderAbs,
    text: result.text,
    language: result.language,
    durationSec: result.durationSec ?? ready.durationSec ?? job.durationSec,
    model: result.model,
    provider: result.provider,
    segments: result.segments,
    startedAt,
  });
  opts?.onProgress?.(100, "ASR complete", "finalize");

  parlLog("info", "asr done", {
    id: job.id,
    provider: result.provider,
    model: result.model,
    chars: result.text.length,
    segments: result.segments.length,
  });

  return {
    text: result.text,
    language: result.language,
    durationSec: result.durationSec ?? ready.durationSec ?? job.durationSec,
    model: result.model,
    segmentCount: result.segments.length,
    provider: result.provider,
    audioPath: relativeToCwd(audioAbs),
  };
}

export { isRetryableAsrError };

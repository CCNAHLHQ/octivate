import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { pythonPath, whisperModel } from "@/lib/parliamentary/config";
import { assertVideoReady } from "@/lib/parliamentary/download";
import { estimateAsrSeconds } from "@/lib/parliamentary/estimate";
import { parlLog } from "@/lib/parliamentary/log";
import type { MediaJob } from "@/lib/parliamentary/types";

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

export async function transcribeMediaJob(job: MediaJob) {
  if (!job.folder || !job.videoPath) throw new Error("missing_video_paths");
  const folderAbs = path.isAbsolute(job.folder)
    ? job.folder
    : path.join(process.cwd(), job.folder);
  const videoAbs = path.isAbsolute(job.videoPath)
    ? job.videoPath
    : path.join(process.cwd(), job.videoPath);

  // Refuse ASR until download phase left a verified marker + readable media.
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

  const model = whisperModel();
  const script = path.join(process.cwd(), "tools", "parl-asr", "transcribe_worker.py");
  const outJsonl = path.join(folderAbs, "transcript.jsonl");
  const jobJson = path.join(folderAbs, "asr-job.json");
  const startedAt = new Date().toISOString();

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

  parlLog("info", "asr start", {
    id: job.id,
    model,
    etaSec: estimateAsrSeconds(job.durationSec, model),
  });
  const result = await runPython(script, ["--job", jobJson]);
  if (result.code !== 0) throw new Error(`asr_failed:${result.stderr.slice(0, 500)}`);

  const finishedAt = new Date().toISOString();
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
    "language",
    "started_at",
    "finished_at",
    "text",
    "segment_start",
    "segment_end",
  ];
  const rows = [
    {
      media_id: job.id,
      title: job.title,
      country: job.country,
      platform: job.platform,
      source_page_url: job.pageUrl,
      media_url: job.mediaUrl,
      folder: job.folder,
      duration_sec: durationSec,
      transcript_status: "octivate_machine_transcript",
      model,
      language,
      started_at: startedAt,
      finished_at: finishedAt,
      text: text.trim(),
      segment_start: "",
      segment_end: "",
    },
    ...segments.map((s) => ({
      media_id: job.id,
      title: job.title,
      country: job.country,
      platform: job.platform,
      source_page_url: job.pageUrl,
      media_url: job.mediaUrl,
      folder: job.folder,
      duration_sec: durationSec,
      transcript_status: "octivate_machine_transcript",
      model,
      language,
      started_at: startedAt,
      finished_at: finishedAt,
      text: s.text,
      segment_start: s.start,
      segment_end: s.end,
    })),
  ];
  await fs.writeFile(
    path.join(folderAbs, "transcripts.csv"),
    `${headers.join(",")}\n${rows
      .map((r) => headers.map((h) => csvEscape((r as Record<string, unknown>)[h])).join(","))
      .join("\n")}\n`,
    "utf8"
  );

  try {
    const metaPath = path.join(folderAbs, "meta.json");
    const meta = JSON.parse(await fs.readFile(metaPath, "utf8")) as Record<string, unknown>;
    meta.transcribedAt = finishedAt;
    meta.transcriptStatus = "octivate_machine_transcript";
    meta.model = model;
    meta.durationSec = durationSec;
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
  } catch {
    /* optional */
  }

  parlLog("info", "asr done", { id: job.id, chars: text.length, segments: segments.length });
  return { text: text.trim(), language, durationSec, model, segmentCount: segments.length };
}

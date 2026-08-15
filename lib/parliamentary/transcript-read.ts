import { promises as fs } from "fs";
import path from "path";
import { mediaRoot } from "@/lib/parliamentary/paths";
import { readJobs } from "@/lib/parliamentary/store";

export type TranscriptPayload = {
  jobId: string;
  title: string;
  model?: string;
  asrProvider?: string;
  text: string;
  segmentCount: number;
  folder: string;
  files: { jsonl: boolean; csv: boolean };
};

function resolveJobFolder(folderRel: string) {
  const abs = path.resolve(
    path.isAbsolute(folderRel) ? folderRel : path.join(process.cwd(), folderRel)
  );
  const root = path.resolve(mediaRoot());
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("transcript_path_outside_media_root");
  }
  return abs;
}

export async function loadJobTranscript(jobId: string): Promise<TranscriptPayload | null> {
  const jobs = await readJobs();
  const job = jobs.find((j) => j.id === jobId);
  if (!job?.folder) return null;
  if (job.stage !== "done" && job.transcriptStatus !== "octivate_machine_transcript") {
    // Still allow read if artifacts exist after partial state
  }

  const folderAbs = resolveJobFolder(job.folder);
  const jsonlPath = path.join(folderAbs, "transcript.jsonl");
  const csvPath = path.join(folderAbs, "transcripts.csv");

  let text = "";
  let segmentCount = 0;
  let model = job.model;
  let asrProvider = job.asrProvider;
  let hasJsonl = false;
  let hasCsv = false;

  try {
    const raw = await fs.readFile(jsonlPath, "utf8");
    hasJsonl = true;
    for (const line of raw.split(/\r?\n/).filter(Boolean)) {
      const row = JSON.parse(line) as {
        type?: string;
        text?: string;
        model?: string;
        provider?: string;
      };
      if (row.type === "summary" && row.text) {
        text = row.text.trim();
        if (row.model) model = row.model;
        if (row.provider === "openrouter" || row.provider === "local") {
          asrProvider = row.provider;
        }
      } else if (row.type === "segment" && row.text) {
        segmentCount += 1;
        if (!text) text += `${row.text.trim()} `;
      }
    }
    text = text.trim();
  } catch {
    /* try csv later */
  }

  try {
    await fs.access(csvPath);
    hasCsv = true;
  } catch {
    /* optional */
  }

  if (!text && !hasCsv && !hasJsonl) return null;

  try {
    const meta = JSON.parse(
      await fs.readFile(path.join(folderAbs, "meta.json"), "utf8")
    ) as { model?: string; asrProvider?: string };
    model = model || meta.model;
    if (meta.asrProvider === "openrouter" || meta.asrProvider === "local") {
      asrProvider = asrProvider || meta.asrProvider;
    }
  } catch {
    /* optional */
  }

  return {
    jobId: job.id,
    title: job.title,
    model,
    asrProvider,
    text,
    segmentCount,
    folder: job.folder,
    files: { jsonl: hasJsonl, csv: hasCsv },
  };
}

export async function readTranscriptFile(
  jobId: string,
  format: "txt" | "csv" | "jsonl"
): Promise<{ body: string; contentType: string; filename: string } | null> {
  const jobs = await readJobs();
  const job = jobs.find((j) => j.id === jobId);
  if (!job?.folder) return null;
  const folderAbs = resolveJobFolder(job.folder);
  const slug = job.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || job.id;

  if (format === "csv") {
    const p = path.join(folderAbs, "transcripts.csv");
    try {
      const body = await fs.readFile(p, "utf8");
      return {
        body,
        contentType: "text/csv; charset=utf-8",
        filename: `${slug}-transcript.csv`,
      };
    } catch {
      return null;
    }
  }

  if (format === "jsonl") {
    const p = path.join(folderAbs, "transcript.jsonl");
    try {
      const body = await fs.readFile(p, "utf8");
      return {
        body,
        contentType: "application/x-ndjson; charset=utf-8",
        filename: `${slug}-transcript.jsonl`,
      };
    } catch {
      return null;
    }
  }

  const loaded = await loadJobTranscript(jobId);
  if (!loaded?.text) return null;
  return {
    body: loaded.text,
    contentType: "text/plain; charset=utf-8",
    filename: `${slug}-transcript.txt`,
  };
}

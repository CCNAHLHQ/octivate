import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { EvidenceDocument } from "@/lib/evidence/types";
import { labelTextFromSource } from "@/lib/evidence/labeler";
import { mediaRoot } from "@/lib/parliamentary/paths";
import { uid } from "@/lib/store/json-store";
import type { Source } from "@/lib/types";

export type TranscriptLoadOpts = {
  folder?: string;
  projectId?: string;
  sourceId?: string;
  maxChars?: number;
  question?: string;
  projectSector?: string;
  sourceHint?: Partial<Source> & { id: string; title: string };
};

/**
 * Load a parliamentary ASR transcript into an EvidenceDocument.
 * Always labels channel notes as octivate_machine_transcript — never Hansard.
 */
export async function evidenceFromMachineTranscript(
  opts?: TranscriptLoadOpts
): Promise<EvidenceDocument | null> {
  const folderAbs = opts?.folder
    ? path.isAbsolute(opts.folder)
      ? opts.folder
      : path.join(process.cwd(), opts.folder)
    : await findLatestTranscriptFolder();
  if (!folderAbs) return null;

  const jsonl = path.join(folderAbs, "transcript.jsonl");
  let text = "";
  let title = path.basename(folderAbs);
  try {
    const raw = await fs.readFile(jsonl, "utf8");
    for (const line of raw.split(/\r?\n/).filter(Boolean)) {
      const row = JSON.parse(line) as { type?: string; text?: string };
      if (row.type === "summary" && row.text) {
        text = row.text;
        break;
      }
      if (row.type === "segment" && row.text) text += `${row.text} `;
    }
  } catch {
    return null;
  }
  text = text.trim();
  if (!text) return null;

  try {
    const meta = JSON.parse(
      await fs.readFile(path.join(folderAbs, "meta.json"), "utf8")
    ) as { title?: string; mediaUrl?: string; pageUrl?: string };
    title = opts?.sourceHint?.title || meta.title || title;
    const maxChars = opts?.maxChars ?? 14_000;
    const clipped = text.slice(0, maxChars);
    const sourceId = opts?.sourceId || opts?.sourceHint?.id;
    const hint: Source = {
      id: sourceId || "parl_unknown",
      title,
      tier: 2,
      country: opts?.sourceHint?.country || "Regional",
      type: "Parliamentary video transcript",
      health: "healthy",
      lastChecked: new Date().toISOString(),
      psnLayers: opts?.sourceHint?.psnLayers || ["Power", "Systems", "Narratives"],
      sectorTags: opts?.sourceHint?.sectorTags || ["Parliamentary", "Governance"],
      userRelevance: opts?.sourceHint?.userRelevance || ["octivate_machine_transcript"],
    };
    const labels = [
      {
        kind: "custom" as const,
        value: "octivate_machine_transcript",
        weight: 1,
        method: "rule" as const,
      },
      ...labelTextFromSource(
        clipped,
        hint,
        opts?.question || "",
        opts?.projectSector || ""
      ),
    ];
    return {
      id: uid("evd"),
      sourceId,
      projectId: opts?.projectId,
      title,
      url: meta.pageUrl || meta.mediaUrl,
      text: clipped,
      sha256: createHash("sha256").update(clipped).digest("hex"),
      channels: [
        {
          kind: "summary",
          text: clipped,
          confidence: 0.55,
          extractedAt: new Date().toISOString(),
          path: path.relative(process.cwd(), jsonl).replace(/\\/g, "/"),
          notes: "octivate_machine_transcript",
        },
      ],
      labels,
      routes: ["parliamentary-video"],
      captureFolder: path.relative(process.cwd(), folderAbs).replace(/\\/g, "/"),
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function findLatestTranscriptFolder(): Promise<string | null> {
  const root = mediaRoot();
  const found: { mtime: number; dir: string }[] = [];

  async function walk(dir: string, depth: number) {
    if (depth > 6) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const full = path.join(dir, ent.name);
      try {
        await fs.access(path.join(full, "transcript.jsonl"));
        const st = await fs.stat(path.join(full, "transcript.jsonl"));
        found.push({ mtime: st.mtimeMs, dir: full });
      } catch {
        await walk(full, depth + 1);
      }
    }
  }

  await walk(root, 0);
  if (!found.length) return null;
  found.sort((a, b) => b.mtime - a.mtime);
  return found[0].dir;
}

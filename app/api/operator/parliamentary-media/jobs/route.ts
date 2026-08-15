import path from "path";
import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { requireOperatorUser, resolveRequestUser } from "@/lib/auth/scope";
import { parseVimeoVideoId } from "@/lib/parliamentary/detect";
import { summarizeParlError } from "@/lib/parliamentary/errors";
import { readJobs } from "@/lib/parliamentary/store";
import { previewPathForVimeo } from "@/lib/parliamentary/thumb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  const url = req.nextUrl;
  const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize") || 5) || 5)
  );

  const jobs = await readJobs();
  const sorted = [...jobs].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  );
  const total = sorted.length;
  const start = (page - 1) * pageSize;
  const items = sorted.slice(start, start + pageSize).map((j) => {
    const vimeoId =
      j.vimeoId ||
      (j.platform === "vimeo" ? parseVimeoVideoId(j.mediaUrl) : undefined) ||
      parseVimeoVideoId(j.mediaUrl);
    // Legacy rows stuffed stack traces into `error` — split for UI.
    const legacyDump = !j.errorDetail && j.error && j.error.length > 160;
    const summary = j.error || j.errorDetail ? summarizeParlError(j.errorDetail || j.error) : null;
    return {
      id: j.id,
      title: j.title,
      country: j.country,
      platform: j.platform,
      stage: j.stage,
      progressPct: j.progressPct,
      progressPhase: j.progressPhase,
      progressLabel: j.progressLabel,
      bytesDownloaded: j.bytesDownloaded,
      bytesTotal: j.bytesTotal,
      bytesPerSec: j.bytesPerSec,
      retryCount: j.retryCount,
      asrProvider: j.asrProvider,
      model: j.model || null,
      transcriptStatus: j.transcriptStatus || null,
      hasTranscript:
        j.stage === "done" || j.transcriptStatus === "octivate_machine_transcript",
      updatedAt: j.updatedAt,
      error: legacyDump ? summary?.headline : j.error || summary?.headline,
      errorDetail: j.errorDetail || (legacyDump ? j.error : undefined),
      folder: j.folder || null,
      folderAbs: j.folder
        ? path.isAbsolute(j.folder)
          ? j.folder
          : path.resolve(process.cwd(), j.folder)
        : null,
      mediaUrl: j.mediaUrl,
      pageUrl: j.pageUrl,
      vimeoId: vimeoId || null,
      durationSec: j.durationSec,
      estimateAsrSec: j.estimateAsrSec,
      previewUrl: vimeoId ? previewPathForVimeo(vimeoId) : null,
    };
  });

  return jsonOk({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

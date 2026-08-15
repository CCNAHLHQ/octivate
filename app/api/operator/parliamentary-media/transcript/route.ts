import { NextRequest, NextResponse } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { requireOperatorUser, resolveRequestUser } from "@/lib/auth/scope";
import {
  loadJobTranscript,
  readTranscriptFile,
} from "@/lib/parliamentary/transcript-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  const id = String(req.nextUrl.searchParams.get("id") || "").trim();
  if (!id) return jsonError("Missing job id", 400);

  const download = ["1", "true", "yes"].includes(
    String(req.nextUrl.searchParams.get("download") || "").toLowerCase()
  );
  const formatRaw = String(req.nextUrl.searchParams.get("format") || "txt").toLowerCase();
  const format = (formatRaw === "csv" || formatRaw === "jsonl" ? formatRaw : "txt") as
    | "txt"
    | "csv"
    | "jsonl";

  if (download) {
    try {
      const file = await readTranscriptFile(id, format);
      if (!file) return jsonError("Transcript not found", 404);
      return new NextResponse(file.body, {
        status: 200,
        headers: {
          "Content-Type": file.contentType,
          "Content-Disposition": `attachment; filename="${file.filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Download failed", 500);
    }
  }

  try {
    const payload = await loadJobTranscript(id);
    if (!payload) return jsonError("Transcript not found", 404);
    return jsonOk({ transcript: payload });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Load failed", 500);
  }
}

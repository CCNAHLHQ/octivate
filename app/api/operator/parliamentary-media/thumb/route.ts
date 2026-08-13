import { NextRequest, NextResponse } from "next/server";
import { guardApi, jsonError } from "@/lib/security/guard";
import { requireOperatorUser, resolveRequestUser } from "@/lib/auth/scope";
import { loadVimeoThumbnail } from "@/lib/parliamentary/thumb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same-origin Vimeo poster proxy (CSP blocks third-party img hosts). */
export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true, progress: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  const id = String(req.nextUrl.searchParams.get("id") || "").replace(/\D/g, "");
  if (!id || id.length < 5) return jsonError("Missing vimeo id", 400);

  const inm = req.headers.get("if-none-match");
  try {
    const thumb = await loadVimeoThumbnail(id);
    if (!thumb) return jsonError("Thumbnail unavailable", 404);
    if (inm && inm === thumb.etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: thumb.etag } });
    }
    return new NextResponse(new Uint8Array(thumb.bytes), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
        ETag: thumb.etag,
      },
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Thumb failed", 502);
  }
}

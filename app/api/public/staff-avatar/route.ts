import { NextRequest, NextResponse } from "next/server";
import { guardApi, jsonError } from "@/lib/security/guard";
import { readAvatarFile } from "@/lib/auth/avatar";
import type { StaffProfileId } from "@/lib/auth/types";
import { findUserByStaffProfileId } from "@/lib/auth/users";
import { staffById } from "@/lib/support/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED: StaffProfileId[] = ["shemuel", "nirvana", "jaden"];

/**
 * Public read of staff/founder avatars only — never arbitrary member photos.
 */
export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;

  const profile = (req.nextUrl.searchParams.get("profile") || "").trim() as StaffProfileId;
  if (!ALLOWED.includes(profile) || !staffById(profile)) {
    return jsonError("Unknown staff profile", 404);
  }

  const user = await findUserByStaffProfileId(profile);
  if (!user?.avatarExt) {
    return new NextResponse(null, { status: 404 });
  }

  const file = await readAvatarFile(user.id, user.avatarExt);
  if (!file) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.buffer.length),
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}

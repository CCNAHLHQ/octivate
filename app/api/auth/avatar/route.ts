import { NextRequest, NextResponse } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { resolveRequestUser } from "@/lib/auth/scope";
import {
  deleteAvatarFiles,
  parseDataUrlImage,
  readAvatarFile,
  writeAvatarFile,
} from "@/lib/auth/avatar";
import {
  findUserById,
  toPublicUser,
  updateUserProfile,
} from "@/lib/auth/users";
import {
  avatarMaxBytes,
  formatAvatarLimit,
  getOperatorLimits,
  toProfileLimitsPublic,
} from "@/lib/auth/profile-limits";
import { emitOpsEvent } from "@/lib/ops/event-log";

export const dynamic = "force-dynamic";
/** Allow larger avatar data URLs (up to ~10 MB binary ≈ ~14 MB JSON). */
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  const sessionUser = await resolveRequestUser(req);
  if (!sessionUser) return jsonError("Sign in required", 401);

  const requestedId = req.nextUrl.searchParams.get("userId") || sessionUser.id;
  if (
    requestedId !== sessionUser.id &&
    sessionUser.role !== "operator"
  ) {
    return jsonError("Forbidden", 403);
  }

  const fresh = await findUserById(requestedId);
  if (!fresh?.avatarExt) {
    return new NextResponse(null, { status: 404 });
  }

  const file = await readAvatarFile(fresh.id, fresh.avatarExt);
  if (!file) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.buffer.length),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}

export async function POST(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  if (!user) return jsonError("Sign in required", 401);

  const limits = await getOperatorLimits();
  const maxBytes = avatarMaxBytes(limits);
  let buffer: Buffer;
  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("avatar");
      if (!(file instanceof File)) return jsonError("avatar file is required");
      if (file.size > maxBytes) {
        return jsonError(`Avatar must be under ${formatAvatarLimit(limits.maxAvatarSizeKb)}`);
      }
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = (await req.json()) as { dataUrl?: string };
      if (!body.dataUrl) return jsonError("dataUrl is required");
      buffer = parseDataUrlImage(String(body.dataUrl));
      if (buffer.length > maxBytes) {
        return jsonError(`Avatar must be under ${formatAvatarLimit(limits.maxAvatarSizeKb)}`);
      }
    }

    const saved = await writeAvatarFile(user.id, buffer, maxBytes);
    const updated = await updateUserProfile(user.id, {
      avatarExt: saved.ext,
      avatarUpdatedAt: new Date().toISOString(),
    });
    if (!updated) return jsonError("User not found", 404);

    void emitOpsEvent({
      level: "info",
      source: "security",
      message: "Avatar updated",
      meta: {
        userId: user.id,
        mime: saved.mime,
        bytes: buffer.length,
        maxKb: limits.maxAvatarSizeKb,
      },
    });

    return jsonOk({
      user: toPublicUser(updated),
      profileLimits: toProfileLimitsPublic(limits),
      message: "Avatar updated",
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Upload failed", 400);
  }
}

export async function DELETE(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  if (!user) return jsonError("Sign in required", 401);

  await deleteAvatarFiles(user.id);
  const updated = await updateUserProfile(user.id, {
    avatarExt: null,
    avatarUpdatedAt: null,
  });
  if (!updated) return jsonError("User not found", 404);

  void emitOpsEvent({
    level: "info",
    source: "security",
    message: "Avatar removed",
    meta: { userId: user.id },
  });

  const limits = await getOperatorLimits();
  return jsonOk({
    user: toPublicUser(updated),
    profileLimits: toProfileLimitsPublic(limits),
    message: "Avatar removed",
  });
}

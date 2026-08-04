import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { resolveRequestSession, resolveRequestUser } from "@/lib/auth/scope";
import {
  changeUserPassword,
  findUserById,
  normalizePresence,
  toPublicUser,
  updateUserProfile,
} from "@/lib/auth/users";
import { sanitizeBbcodeSource } from "@/lib/auth/bbcode";
import {
  getOperatorLimits,
  toProfileLimitsPublic,
} from "@/lib/auth/profile-limits";
import { emitOpsEvent } from "@/lib/ops/event-log";
import type { PresenceStatus } from "@/lib/auth/types";

export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const session = await resolveRequestSession(req);
  const limits = await getOperatorLimits();
  return jsonOk({
    user,
    profileLimits: toProfileLimitsPublic(limits),
    signup: {
      allowAutogenerateAccounts: limits.allowAutogenerateAccounts !== false,
    },
    session: session
      ? {
          expiresAt: session.expiresAt,
          createdAt: session.createdAt,
        }
      : null,
  });
}

export async function PATCH(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  const sessionUser = await resolveRequestUser(req);
  if (!sessionUser) return jsonError("Sign in required", 401);

  let body: {
    displayName?: string;
    description?: string;
    presenceStatus?: string;
    currentPassword?: string;
    newPassword?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  try {
    const limits = await getOperatorLimits();

    if (body.newPassword) {
      if (!body.currentPassword) {
        return jsonError("Current password is required to set a new password");
      }
      await changeUserPassword(
        sessionUser.id,
        String(body.currentPassword),
        String(body.newPassword)
      );
      void emitOpsEvent({
        level: "info",
        source: "security",
        message: "Password changed",
        meta: { userId: sessionUser.id },
      });
    }

    const patch: {
      displayName?: string;
      description?: string;
      presenceStatus?: PresenceStatus;
    } = {};
    if (body.displayName !== undefined) {
      patch.displayName = String(body.displayName);
    }
    if (body.description !== undefined) {
      patch.description = sanitizeBbcodeSource(
        String(body.description),
        limits.maxProfileBioChars
      );
    }
    if (body.presenceStatus !== undefined) {
      patch.presenceStatus = normalizePresence(body.presenceStatus);
    }
    if (Object.keys(patch).length) {
      await updateUserProfile(sessionUser.id, patch);
    }

    const fresh = await findUserById(sessionUser.id);
    if (!fresh) return jsonError("User not found", 404);
    return jsonOk({
      user: toPublicUser(fresh),
      profileLimits: toProfileLimitsPublic(limits),
      message: "Profile updated",
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Update failed", 400);
  }
}

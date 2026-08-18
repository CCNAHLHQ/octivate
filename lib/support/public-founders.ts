import { findUserByStaffProfileId, normalizePresence } from "@/lib/auth/users";
import { STAFF_PROFILES } from "@/lib/support/staff";
import {
  initialsOf,
  type PublicFounder,
} from "@/lib/support/founder-meta";

export type { PublicFounder } from "@/lib/support/founder-meta";
export {
  founderDescKey,
  founderPresenceKey,
  founderRoleKey,
  initialsOf,
} from "@/lib/support/founder-meta";

/** Public-safe founder cards with live avatar URLs + presence for Team page. */
export async function listPublicFounders(): Promise<PublicFounder[]> {
  const out: PublicFounder[] = [];
  for (const profile of STAFF_PROFILES) {
    const user = await findUserByStaffProfileId(profile.id);
    const v = user?.avatarUpdatedAt || user?.id || "";
    const avatarUrl = user?.avatarExt
      ? `/api/public/staff-avatar?profile=${encodeURIComponent(profile.id)}&v=${encodeURIComponent(v)}`
      : null;
    out.push({
      id: profile.id,
      name: profile.name,
      role: profile.role,
      tone: profile.tone,
      avatarUrl,
      initials: initialsOf(profile.name),
      presenceStatus: normalizePresence(user?.presenceStatus),
    });
  }
  return out;
}

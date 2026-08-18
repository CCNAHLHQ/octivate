import type { PresenceStatus, StaffProfileId } from "@/lib/auth/types";

export type PublicFounder = {
  id: StaffProfileId;
  name: string;
  role: string;
  tone: "violet" | "tide" | "coral";
  /** Public staff-avatar URL when the operator has uploaded a photo. */
  avatarUrl: string | null;
  initials: string;
  /** Live operator presence from account settings. */
  presenceStatus: PresenceStatus;
};

const ROLE_KEY: Record<StaffProfileId, string> = {
  shemuel: "support.page.role.founder",
  nirvana: "support.page.role.ai",
  jaden: "support.page.role.tech",
};

const DESC_KEY: Record<StaffProfileId, string> = {
  shemuel: "support.page.role.founderDesc",
  nirvana: "support.page.role.aiDesc",
  jaden: "support.page.role.techDesc",
};

const PRESENCE_KEY: Record<PresenceStatus, string> = {
  available: "support.page.presence.available",
  away: "support.page.presence.away",
  busy: "support.page.presence.busy",
  offline: "support.page.presence.offline",
};

export function founderRoleKey(id: StaffProfileId) {
  return ROLE_KEY[id];
}

export function founderDescKey(id: StaffProfileId) {
  return DESC_KEY[id];
}

export function founderPresenceKey(status: PresenceStatus) {
  return PRESENCE_KEY[status];
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

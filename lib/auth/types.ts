import type { BillingInterval, PlanId } from "@/lib/billing/plans";

export type UserRole = "member" | "operator";

export type StaffProfileId = "shemuel" | "jaden";

/** Global presence — also drives Customer Support readiness cues. */
export type PresenceStatus = "available" | "away" | "busy" | "offline";

export const PRESENCE_OPTIONS: {
  id: PresenceStatus;
  label: string;
  supportHint: string;
}[] = [
  {
    id: "available",
    label: "Available",
    supportHint: "Ready to claim and handle support threads",
  },
  {
    id: "away",
    label: "Away",
    supportHint: "Limited availability for support",
  },
  {
    id: "busy",
    label: "Busy",
    supportHint: "In conversation — limited new claims",
  },
  {
    id: "offline",
    label: "Offline",
    supportHint: "Not handling support right now",
  },
];

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  staffProfileId?: StaffProfileId;
  supabaseUserId?: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
  disabled?: boolean;
  /** File extension for avatar on disk (jpg|png|webp). */
  avatarExt?: string;
  avatarUpdatedAt?: string;
  /** Profile description stored as sanitized BBCode source. */
  description?: string;
  presenceStatus?: PresenceStatus;
  /** Active billing catalogue plan (from checkout / paid merchant order). */
  billingPlanId?: PlanId;
  billingInterval?: BillingInterval;
  billingUpdatedAt?: string;
  billingOrderId?: string;
};

/** Safe shape returned to clients — never includes hashes/salts. */
export type PublicUser = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  staffProfileId?: StaffProfileId;
  createdAt: string;
  disabled?: boolean;
  /** Cache-busted URL for the user's avatar, if set. */
  avatarUrl?: string | null;
  /** BBCode source for profile description. */
  description?: string;
  presenceStatus?: PresenceStatus;
  billingPlanId?: PlanId;
  billingInterval?: BillingInterval;
  billingUpdatedAt?: string;
};

export type AuthSession = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
};

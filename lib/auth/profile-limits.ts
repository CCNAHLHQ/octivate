import { DEFAULT_LIMITS } from "@/lib/mock/seed";
import type { OperatorLimits } from "@/lib/types";

/** Merge stored limits with defaults so older limits.json stays valid. */
export function normalizeLimits(raw?: Partial<OperatorLimits> | null): OperatorLimits {
  const rawKb = Number(raw?.maxAvatarSizeKb);
  // Migrate legacy 512 KB defaults up to the 2 MB platform default.
  const avatarKb =
    !Number.isFinite(rawKb) || rawKb < 1024
      ? DEFAULT_LIMITS.maxAvatarSizeKb
      : rawKb;
  const retention = Number(raw?.documentRetentionDays ?? DEFAULT_LIMITS.documentRetentionDays);
  return {
    ...DEFAULT_LIMITS,
    ...(raw || {}),
    maxAvatarSizeKb: Math.min(10_240, Math.max(1024, avatarKb)),
    maxProfileBioChars: Math.min(
      10_000,
      Math.max(200, Number(raw?.maxProfileBioChars ?? DEFAULT_LIMITS.maxProfileBioChars) || 2000)
    ),
    documentRetentionDays: Math.min(
      3650,
      Math.max(1, Number.isFinite(retention) ? Math.round(retention) : 30)
    ),
    allowAutogenerateAccounts:
      raw?.allowAutogenerateAccounts !== undefined
        ? Boolean(raw.allowAutogenerateAccounts)
        : DEFAULT_LIMITS.allowAutogenerateAccounts !== false,
    mockOpenRouter: false,
  };
}

export async function getOperatorLimits(): Promise<OperatorLimits> {
  const { readOperatorLimits } = await import("@/lib/usage/usage-store");
  const raw = await readOperatorLimits();
  return normalizeLimits(raw);
}

export function avatarMaxBytes(limits: OperatorLimits): number {
  return Math.round(limits.maxAvatarSizeKb * 1024);
}

/** Human-readable avatar cap (prefers MB). */
export function formatAvatarLimit(kb: number): string {
  const mb = kb / 1024;
  if (mb >= 1) {
    const rounded = Math.round(mb * 10) / 10;
    return `${rounded % 1 === 0 ? Math.round(rounded) : rounded} MB`;
  }
  return `${Math.round(kb)} KB`;
}

export type ProfileLimitsPublic = {
  maxAvatarSizeKb: number;
  maxAvatarBytes: number;
  maxAvatarLabel: string;
  maxProfileBioChars: number;
  allowAutogenerateAccounts: boolean;
};

export function toProfileLimitsPublic(limits: OperatorLimits): ProfileLimitsPublic {
  return {
    maxAvatarSizeKb: limits.maxAvatarSizeKb,
    maxAvatarBytes: avatarMaxBytes(limits),
    maxAvatarLabel: formatAvatarLimit(limits.maxAvatarSizeKb),
    maxProfileBioChars: limits.maxProfileBioChars,
    allowAutogenerateAccounts: limits.allowAutogenerateAccounts !== false,
  };
}

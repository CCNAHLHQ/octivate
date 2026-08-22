import type { BillingInterval, PlanId } from "@/lib/billing/plans";
import { canUpgradePlan, PAID_PLAN_IDS } from "@/lib/billing/plans";
import {
  findUserByEmail,
  findUserById,
  toPublicUser,
  updateUserBilling,
} from "@/lib/auth/users";
import type { PublicUser } from "@/lib/auth/types";

export async function applyPlanEntitlement(input: {
  userId?: string | null;
  emails?: string[];
  planId: PlanId;
  interval: BillingInterval;
  orderId?: string;
  /** When true, only apply if target is a strict upgrade (or first paid plan). */
  upgradeOnly?: boolean;
}): Promise<PublicUser | null> {
  if (!PAID_PLAN_IDS.includes(input.planId)) return null;

  let user = input.userId ? await findUserById(input.userId) : null;
  if (!user && input.emails?.length) {
    for (const email of input.emails) {
      user = await findUserByEmail(email);
      if (user) break;
    }
  }
  if (!user || user.disabled) return null;
  if (user.role === "operator") return toPublicUser(user);

  if (input.upgradeOnly && !canUpgradePlan(user.billingPlanId, input.planId)) {
    return toPublicUser(user);
  }

  const updated = await updateUserBilling(user.id, {
    billingPlanId: input.planId,
    billingInterval: input.interval,
    billingOrderId: input.orderId,
  });
  return updated ? toPublicUser(updated) : null;
}

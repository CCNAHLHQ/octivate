/**
 * Checkout promo catalogue. Discount math lives only here — never trust client amounts.
 */
import type { BillingInterval, PlanId } from "@/lib/billing/plans";
import { formatMoney } from "@/lib/billing/plans";

export type PromoKind = "fixed";

export type PromoDefinition = {
  code: string;
  kind: PromoKind;
  /** Fixed USD off when kind === "fixed" */
  amount: number;
  currency: "USD";
  label: string;
  description: string;
  appliesTo: PlanId[];
  active: boolean;
  /** Pre-selected when checkout opens */
  defaultOffer?: boolean;
};

export const PROMO_CATALOG: PromoDefinition[] = [
  {
    code: "OCTIVATE10",
    kind: "fixed",
    amount: 2,
    currency: "USD",
    label: "OCTIVATE10",
    description: "Welcome discount on paid plans",
    appliesTo: ["single", "team"],
    active: true,
    defaultOffer: true,
  },
];

export const DEFAULT_PROMO_CODE = "OCTIVATE10";

const MAX_CODE_LEN = 32;

export function normalizePromoCode(raw: unknown): string {
  const s = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^A-Z0-9_-]/g, "");
  return s.slice(0, MAX_CODE_LEN);
}

function roundMoney(n: number): number {
  return Math.round(Math.max(0, n) * 100) / 100;
}

export function getPromo(code: string): PromoDefinition | undefined {
  const normalized = normalizePromoCode(code);
  if (!normalized) return undefined;
  return PROMO_CATALOG.find((p) => p.code === normalized);
}

export function listAvailablePromos(
  planId: PlanId,
  _interval: BillingInterval
): PromoDefinition[] {
  void _interval;
  return PROMO_CATALOG.filter(
    (p) => p.active && p.appliesTo.includes(planId) && planId !== "free"
  );
}

export type ApplyPromoInput = {
  code: string;
  planId: PlanId;
  interval: BillingInterval;
  listAmount: number;
};

export type ApplyPromoOk = {
  ok: true;
  code: string;
  label: string;
  description: string;
  discount: number;
  payable: number;
  listAmount: number;
  currency: "USD";
  saveLabel: string;
};

export type ApplyPromoErr = {
  ok: false;
  error: string;
};

export type ApplyPromoResult = ApplyPromoOk | ApplyPromoErr;

export function applyPromo(input: ApplyPromoInput): ApplyPromoResult {
  const code = normalizePromoCode(input.code);
  if (!code) return { ok: false, error: "Enter a promo code" };

  const promo = getPromo(code);
  if (!promo || !promo.active) {
    return { ok: false, error: "Promo code not found" };
  }
  if (input.planId === "free" || !promo.appliesTo.includes(input.planId)) {
    return { ok: false, error: "Promo code does not apply to this plan" };
  }

  const listAmount = roundMoney(Number(input.listAmount) || 0);
  if (listAmount <= 0) {
    return { ok: false, error: "Promo code does not apply to this amount" };
  }

  let discount = 0;
  if (promo.kind === "fixed") {
    discount = roundMoney(Math.min(promo.amount, listAmount));
  }
  if (discount <= 0) {
    return { ok: false, error: "Promo code has no discount for this order" };
  }

  const payable = roundMoney(listAmount - discount);
  return {
    ok: true,
    code: promo.code,
    label: promo.label,
    description: promo.description,
    discount,
    payable,
    listAmount,
    currency: promo.currency,
    saveLabel: `Save ${formatMoney(discount, promo.currency)}`,
  };
}

export function defaultPromoForPlan(
  planId: PlanId,
  interval: BillingInterval,
  listAmount: number
): ApplyPromoOk | null {
  const def = listAvailablePromos(planId, interval).find((p) => p.defaultOffer);
  if (!def) return null;
  const result = applyPromo({
    code: def.code,
    planId,
    interval,
    listAmount,
  });
  return result.ok ? result : null;
}

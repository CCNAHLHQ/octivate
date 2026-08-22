import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import {
  type BillingInterval,
  type PlanId,
  ALL_INTERVALS,
  PAID_PLAN_IDS,
  getPlan,
  resolvePrice,
} from "@/lib/billing/plans";
import { readBillingPlans } from "@/lib/billing/plans-store";
import {
  applyPromo,
  listAvailablePromos,
  normalizePromoCode,
} from "@/lib/billing/promos";

const PLAN_IDS = new Set<PlanId>(PAID_PLAN_IDS);
const INTERVALS = new Set<BillingInterval>(ALL_INTERVALS);

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { publicMutation: true });
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const planId = String(body.planId || "") as PlanId;
  const interval = String(body.interval || "") as BillingInterval;
  const code = normalizePromoCode(body.code ?? body.promoCode);

  if (!PLAN_IDS.has(planId)) {
    return jsonError("Invalid plan");
  }
  if (!INTERVALS.has(interval)) return jsonError("Invalid billing interval");
  if (!code) return jsonError("Enter a promo code");

  const plans = await readBillingPlans();
  const plan = plans.find((p) => p.id === planId) || getPlan(planId);
  if (!plan.requiresPayment) return jsonError("Plan does not require payment");

  const price = resolvePrice(plan, interval);
  const applied = applyPromo({
    code,
    planId,
    interval,
    listAmount: price.amount,
  });
  if (!applied.ok) return jsonError(applied.error);

  return jsonOk({
    promo: {
      code: applied.code,
      label: applied.label,
      description: applied.description,
      discount: applied.discount,
      payable: applied.payable,
      listAmount: applied.listAmount,
      currency: applied.currency,
      saveLabel: applied.saveLabel,
    },
    available: listAvailablePromos(planId, interval).map((p) => ({
      code: p.code,
      label: p.label,
      description: p.description,
      amount: p.amount,
      currency: p.currency,
      defaultOffer: Boolean(p.defaultOffer),
    })),
  });
}

export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const planId = String(searchParams.get("planId") || "") as PlanId;
  const interval = String(
    searchParams.get("interval") || "monthly"
  ) as BillingInterval;

  if (!PLAN_IDS.has(planId)) {
    return jsonError("Invalid plan");
  }
  if (!INTERVALS.has(interval)) return jsonError("Invalid billing interval");

  const plans = await readBillingPlans();
  const plan = plans.find((p) => p.id === planId) || getPlan(planId);
  if (!plan.requiresPayment) return jsonError("Plan does not require payment");

  const price = resolvePrice(plan, interval);
  const available = listAvailablePromos(planId, interval).map((p) => {
    const preview = applyPromo({
      code: p.code,
      planId,
      interval,
      listAmount: price.amount,
    });
    return {
      code: p.code,
      label: p.label,
      description: p.description,
      amount: p.amount,
      currency: p.currency,
      defaultOffer: Boolean(p.defaultOffer),
      saveLabel: preview.ok ? preview.saveLabel : undefined,
      discount: preview.ok ? preview.discount : undefined,
      payable: preview.ok ? preview.payable : undefined,
    };
  });

  return jsonOk({
    listAmount: price.amount,
    currency: price.currency,
    available,
  });
}

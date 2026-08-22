import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { clientIp } from "@/lib/security/api-key";
import {
  createMerchantOrder,
  type MerchantAccountType,
} from "@/lib/billing/merchant-orders";
import {
  type BillingInterval,
  type PaymentMethodId,
  type PlanId,
  ALL_INTERVALS,
  PAID_PLAN_IDS,
  PAYMENT_METHODS,
  getPlan,
  resolvePrice,
} from "@/lib/billing/plans";
import { readBillingPlans } from "@/lib/billing/plans-store";
import { validateCardCheckout } from "@/lib/billing/card-validation";
import { enrichClientContextFromRequest } from "@/lib/billing/client-context";
import { applyPromo, normalizePromoCode } from "@/lib/billing/promos";
import { applyPlanEntitlement } from "@/lib/billing/entitlements";
import { resolveRequestUser } from "@/lib/auth/scope";

const PLAN_IDS = new Set<PlanId>(PAID_PLAN_IDS);
const METHOD_IDS = new Set<PaymentMethodId>(
  PAYMENT_METHODS.map((m) => m.id)
);
const INTERVALS = new Set<BillingInterval>(ALL_INTERVALS);

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { publicMutation: true });
  if (denied) return denied;

  const sessionUser = await resolveRequestUser(req);
  if (sessionUser?.role === "operator") {
    return jsonError("Operator accounts cannot purchase or upgrade plans", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const accountType = String(body.accountType || "individual") as MerchantAccountType;
  if (accountType !== "individual" && accountType !== "company") {
    return jsonError("Invalid account type");
  }

  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const companyName = String(body.companyName || "").trim();
  const country = String(body.country || "").trim();
  const street = String(body.street || "").trim();
  const city = String(body.city || "").trim();
  const postalCode = String(body.postalCode || "").trim();
  const planId = String(body.planId || "") as PlanId;
  const interval = String(body.interval || "") as BillingInterval;
  let paymentMethodId = String(body.paymentMethodId || "") as PaymentMethodId;
  if (paymentMethodId === "crypto") paymentMethodId = "oxapay";

  const emailsRaw = Array.isArray(body.emails)
    ? body.emails.map((e) => String(e || "").trim().toLowerCase())
    : [String(body.email || body.billingEmail || "").trim().toLowerCase()];
  const emails = [...new Set(emailsRaw.filter(Boolean))];

  if (!firstName || !lastName) return jsonError("First and last name required");
  if (accountType === "company" && !companyName) {
    return jsonError("Company name required");
  }
  if (!country) return jsonError("Country of residence required");
  if (!street) return jsonError("Street address required");
  if (!city) return jsonError("City required");
  if (!postalCode) return jsonError("Postal code required");
  if (!emails.length || !emails.every(isEmail)) {
    return jsonError("Valid billing notification email required");
  }
  if (!PLAN_IDS.has(planId)) {
    return jsonError("Invalid plan");
  }
  if (!INTERVALS.has(interval)) return jsonError("Invalid billing interval");
  if (!METHOD_IDS.has(paymentMethodId)) return jsonError("Invalid payment method");
  if (!body.agreementAccepted) {
    return jsonError("You must agree to the service terms");
  }

  const plans = await readBillingPlans();
  const plan = plans.find((p) => p.id === planId) || getPlan(planId);
  if (!plan.requiresPayment) return jsonError("Plan does not require payment");
  if (!plan.intervals.includes(interval)) {
    return jsonError("Interval not available for this plan");
  }
  const price = resolvePrice(plan, interval);

  const promoRaw = body.promoCode;
  const promoCode =
    promoRaw == null || String(promoRaw).trim() === ""
      ? ""
      : normalizePromoCode(promoRaw);
  let payableAmount = price.amount;
  let listAmount = price.amount;
  let discountAmount: number | undefined;
  let storedPromo: string | undefined;

  if (promoCode) {
    const applied = applyPromo({
      code: promoCode,
      planId,
      interval,
      listAmount: price.amount,
    });
    if (!applied.ok) return jsonError(applied.error);
    payableAmount = applied.payable;
    listAmount = applied.listAmount;
    discountAmount = applied.discount;
    storedPromo = applied.code;
  }

  let cardLast4: string | undefined;
  let cardBrand: string | undefined;
  let cardNiceType: string | undefined;

  if (paymentMethodId === "card") {
    const cardGate = validateCardCheckout({
      cardName: String(body.cardName || ""),
      cardNumber: String(body.cardNumber || ""),
      expiry: String(body.expiry || ""),
      cvc: String(body.cvc || ""),
    });
    if (!cardGate.ok) return jsonError(cardGate.error);
    cardLast4 = cardGate.last4;
    cardBrand = cardGate.brand;
    cardNiceType = cardGate.niceType;
  }

  const ip = clientIp(req);
  const clientContext = enrichClientContextFromRequest(
    req.headers,
    ip,
    body.clientContext
  );

  const order = await createMerchantOrder({
    accountType,
    firstName,
    lastName,
    companyName: companyName || undefined,
    country,
    street,
    city,
    postalCode,
    emails,
    paymentMethodId,
    planId,
    interval,
    amount: payableAmount,
    currency: price.currency,
    listAmount,
    promoCode: storedPromo,
    discountAmount,
    cardLast4,
    cardBrand,
    cryptoAsset:
      paymentMethodId === "oxapay"
        ? String(body.cryptoAsset || "btc")
        : undefined,
    walletAddress:
      paymentMethodId === "oxapay"
        ? String(body.walletAddress || "").trim() || undefined
        : undefined,
    agreementAccepted: true,
    sourceIp: ip,
    clientContext,
    userId: sessionUser?.id,
    providerMeta: {
      requestedProvider: paymentMethodId,
      catalogueName: plan.name,
      ...(cardNiceType ? { cardNiceType } : {}),
      ...(storedPromo
        ? { promoCode: storedPromo, discountAmount: discountAmount ?? 0 }
        : {}),
    },
  });

  /* Provision entitlement immediately for authenticated members so Upgrade UI updates in real time. */
  const entitled = await applyPlanEntitlement({
    userId: sessionUser?.id,
    emails,
    planId,
    interval,
    orderId: order.id,
    upgradeOnly: Boolean(sessionUser),
  });

  return jsonOk({
    order: {
      id: order.id,
      status: order.status,
      planId: order.planId,
      amount: order.amount,
      currency: order.currency,
      listAmount: order.listAmount,
      promoCode: order.promoCode,
      discountAmount: order.discountAmount,
      paymentMethodId: order.paymentMethodId,
      emails: order.emails,
      createdAt: order.createdAt,
    },
    user: entitled,
    message:
      "Purchase recorded. Your workspace plan updates immediately while provider settlement completes.",
  });
}

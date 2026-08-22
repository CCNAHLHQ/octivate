import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutPage } from "@/components/pricing/checkout-page";
import {
  type BillingInterval,
  type PaymentMethodId,
  type PlanId,
  PAYMENT_METHODS,
  getPlan,
} from "@/lib/billing/plans";
import { readBillingPlans } from "@/lib/billing/plans-store";
import "@/app/pricing/pricing.css";
import "@/app/checkout/checkout.css";
import "@/app/phase1-landing.css";

export const metadata: Metadata = {
  title: "Checkout — Octivate | CENSII",
  description:
    "Complete secure checkout for Octivate decision intelligence plans.",
};

export const dynamic = "force-dynamic";

const PLAN_IDS = new Set<PlanId>(["single", "team", "scale"]);
const INTERVALS = new Set<BillingInterval>([
  "one_time",
  "monthly",
  "annual",
  "biennial",
]);
const METHOD_IDS = new Set<PaymentMethodId>(
  PAYMENT_METHODS.filter((m) => m.enabled).map((m) => m.id)
);

type Search = {
  plan?: string;
  interval?: string;
  method?: string;
};

export default async function CheckoutRoute({
  searchParams,
}: {
  searchParams: Promise<Search> | Search;
}) {
  const sp = await Promise.resolve(searchParams);
  const planId = String(sp.plan || "") as PlanId;
  const intervalRaw = String(sp.interval || "") as BillingInterval;
  let methodId = String(sp.method || "") as PaymentMethodId;
  if (methodId === "crypto") methodId = "oxapay";
  if (methodId === "stripe") methodId = "card";

  if (!PLAN_IDS.has(planId)) redirect("/pricing");

  const plans = await readBillingPlans();
  const plan = plans.find((p) => p.id === planId) || getPlan(planId);
  if (!plan.requiresPayment) redirect("/pricing");

  const interval = INTERVALS.has(intervalRaw)
    ? intervalRaw
    : plan.defaultInterval;

  const context = {
    planId,
    interval,
    methodId: METHOD_IDS.has(methodId) ? methodId : undefined,
  };

  return <CheckoutPage context={context} plans={plans} />;
}

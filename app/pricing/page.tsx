import type { Metadata } from "next";
import { PricingPage } from "@/components/pricing/pricing-page";
import { readBillingPlans } from "@/lib/billing/plans-store";
import "./pricing.css";

export const metadata: Metadata = {
  title: "Pricing — Octivate | CENSII",
  description:
    "Start free with the Octivate workspace. Buy a single decision brief or unlock team access for ongoing Caribbean decision intelligence.",
};

/** Always serve operator-saved catalogue amounts (no stale seed flash). */
export const dynamic = "force-dynamic";

export default async function PricingRoute() {
  const plans = await readBillingPlans();
  return <PricingPage initialPlans={plans} />;
}

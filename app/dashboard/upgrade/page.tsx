import type { Metadata } from "next";
import { UpgradePage } from "@/components/pricing/upgrade-page";
import { readBillingPlans } from "@/lib/billing/plans-store";
import "@/app/pricing/pricing.css";
import "@/app/checkout/checkout.css";
import "@/app/upgrade/upgrade.css";
import "@/app/phase1-landing.css";

export const metadata: Metadata = {
  title: "Upgrade — Octivate",
  description: "Upgrade your Octivate workspace plan in place.",
};

export const dynamic = "force-dynamic";

export default async function UpgradeRoute() {
  const plans = await readBillingPlans();
  return <UpgradePage initialPlans={plans} />;
}

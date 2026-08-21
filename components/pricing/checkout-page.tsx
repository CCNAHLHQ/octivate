"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Sparkles } from "lucide-react";
import { OctivateLogo } from "@/components/brand";
import { HeroVideoBackdrop } from "@/components/landing/hero-video-backdrop";
import { BillingCheckoutForm } from "@/components/pricing/billing-checkout";
import {
  type CheckoutContext,
  type PlanDefinition,
  formatMoney,
  getPlan,
  resolvePrice,
} from "@/lib/billing/plans";

const ease = [0.22, 1, 0.36, 1] as const;

export function CheckoutPage({
  context,
  plans,
}: {
  context: CheckoutContext;
  plans: PlanDefinition[];
}) {
  const plan =
    plans.find((p) => p.id === context.planId) || getPlan(context.planId);
  const price = resolvePrice(plan, context.interval);
  const amountLabel = `${formatMoney(price.amount)}${
    price.unitLabel ? ` ${price.unitLabel}` : ""
  }`;

  return (
    <div className="checkout-page">
      <div className="checkout-split">
        <aside className="checkout-brand" aria-label="Octivate brand">
          <div className="checkout-brand-media" aria-hidden>
            <HeroVideoBackdrop />
            <div className="checkout-brand-veil" />
          </div>
          <motion.div
            className="checkout-brand-content"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease }}
          >
            <motion.div
              className="checkout-brand-logo"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.08, ease }}
            >
              <OctivateLogo variant="lockup" height={44} />
            </motion.div>
            <p className="checkout-brand-eyebrow">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Secure checkout
            </p>
            <h1 className="checkout-brand-title">{plan.name}</h1>
            <p className="checkout-brand-price">{amountLabel}</p>
            <p className="checkout-brand-lede">
              Evidence-backed Caribbean decision intelligence — billed with the
              same clarity we bring to every brief.
            </p>
            <ul className="checkout-brand-points">
              <li>
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Encrypted merchant profile
              </li>
              <li>
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Card, PayPal, and OxaPay crypto
              </li>
              <li>
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Operator-reviewed fulfilment
              </li>
            </ul>
          </motion.div>
        </aside>

        <section className="checkout-panel" aria-label="Billing form">
          <BillingCheckoutForm context={context} plans={plans} />
        </section>
      </div>
    </div>
  );
}

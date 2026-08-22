"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  FileText,
  Layers,
  MonitorSmartphone,
  Rocket,
  Sparkles,
  Users,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  type BillingInterval,
  type CheckoutContext,
  type PaymentMethodId,
  type PlanDefinition,
  type PlanId,
  PAYMENT_DISPLAY_ICONS,
  formatMoney,
  intervalLabel,
  resolvePrice,
} from "@/lib/billing/plans";
import { apiFetch } from "@/lib/api-client";
import { touchCheckoutNavigationTrail } from "@/lib/billing/client-context";
import { cn } from "@/lib/utils";

const ICON_TO_METHOD: Record<string, PaymentMethodId> = {
  PayPal: "paypal",
  Visa: "card",
  Mastercard: "card",
  Cryptocurrency: "oxapay",
  Bitcoin: "oxapay",
  Ethereum: "oxapay",
};

const PLAN_ICONS: Record<PlanId, typeof Sparkles> = {
  free: Sparkles,
  single: FileText,
  team: Users,
  scale: Rocket,
};

function checkoutHref(
  planId: PlanId,
  interval: BillingInterval,
  opts?: { methodId?: PaymentMethodId }
) {
  const q = new URLSearchParams({
    plan: planId,
    interval,
  });
  if (opts?.methodId) q.set("method", opts.methodId);
  return `/checkout?${q.toString()}`;
}

function useReveal(deps: unknown[]) {
  useEffect(() => {
    touchCheckoutNavigationTrail();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

function PaymentIcons({
  onPick,
}: {
  onPick?: (label: string) => void;
}) {
  return (
    <div className="pay-row" aria-label="Accepted payment methods">
      {PAYMENT_DISPLAY_ICONS.map((m) => (
        <button
          key={m.label}
          type="button"
          className="pay-item"
          onClick={() => onPick?.(m.label)}
        >
          <span className={cn("pay-logo", m.label === "PayPal" && "is-paypal")}>
            <Image src={m.src} alt={m.alt} width={m.w} height={m.h} unoptimized />
          </span>
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  );
}

export function PricingPage({ initialPlans }: { initialPlans: PlanDefinition[] }) {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanDefinition[]>(initialPlans);
  useReveal([plans]);

  useEffect(() => {
    setPlans(initialPlans);
  }, [initialPlans]);

  useEffect(() => {
    void apiFetch<{ plans: PlanDefinition[] }>("/api/pricing", { skipCache: true })
      .then((res) => {
        if (Array.isArray(res.plans) && res.plans.length) setPlans(res.plans);
      })
      .catch(() => {
        /* keep SSR / operator-saved catalogue */
      });
  }, []);

  function goCheckout(
    planId: PlanId,
    interval?: BillingInterval,
    opts?: { methodId?: PaymentMethodId; extras?: CheckoutContext["extras"] }
  ) {
    const plan = plans.find((p) => p.id === planId);
    if (!plan?.requiresPayment) return;
    void opts?.extras;
    router.push(
      checkoutHref(planId, interval ?? plan.defaultInterval, {
        methodId: opts?.methodId,
      })
    );
  }

  const team = plans.find((p) => p.id === "team");
  const single = plans.find((p) => p.id === "single");
  const scale = plans.find((p) => p.id === "scale");
  const teamPrice = team ? formatMoney(resolvePrice(team, team.defaultInterval).amount) : "—";
  const singlePrice = single
    ? formatMoney(resolvePrice(single, single.defaultInterval).amount)
    : "—";
  const scalePrice = scale
    ? formatMoney(resolvePrice(scale, scale.defaultInterval).amount)
    : "—";

  return (
    <div className="pricing-root">
      <section className="pricing-hero">
        <div className="container">
          <div className="section-head" style={{ marginBottom: "2.5rem" }}>
            <span className="eyebrow">Pricing</span>
            <h1 className="reveal in">Plans built around the decision</h1>
            <p className="lede reveal in" data-delay="1">
              Explore free. Unlock a scoped decision brief for {singlePrice}, Team
              workspace from {teamPrice}/mo, or Scale programme from {scalePrice} for
              longer runway and higher throughput.
            </p>
          </div>

          <div className="pricing-grid">
            <AnimatePresence mode="popLayout">
              {plans.map((plan, i) => {
                const interval = plan.defaultInterval;
                const price = resolvePrice(plan, interval);
                const priceLabel = formatMoney(price.amount);
                const Icon = PLAN_ICONS[plan.id] || Sparkles;

                return (
                  <motion.article
                    key={plan.id}
                    layout
                    className={`price-card reveal in${plan.featured ? " is-featured" : ""}`}
                    data-delay={i + 1}
                    data-plan={plan.id}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.45,
                      delay: i * 0.08,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    whileHover={{ y: -6 }}
                  >
                    <div className="price-card-sheen" aria-hidden />
                    <header className="price-head">
                      <div className="price-title-row">
                        <span className="price-plan-icon" aria-hidden>
                          <Icon className="h-4 w-4" />
                        </span>
                        <h2>{plan.name}</h2>
                        {plan.badge ? <span className="price-badge">{plan.badge}</span> : null}
                      </div>

                      <div className="price-amount">
                        <span className="price-num">{priceLabel}</span>
                        {price.unitLabel ? (
                          <span className="price-unit">{price.unitLabel}</span>
                        ) : null}
                      </div>
                      <p className="price-desc">{plan.description}</p>
                      {price.note ? <p className="price-save">{price.note}</p> : null}
                    </header>

                    <ul className="price-features">
                      {plan.features.map((t) => (
                        <li key={t}>
                          <Check className="feat-check" aria-hidden />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>

                    {plan.accessNote ? (
                      <div className={`price-note is-${plan.accessNote.tone}`}>
                        {plan.accessNote.body}
                      </div>
                    ) : null}

                    {plan.requiresPayment ? (
                      <Link
                        href={checkoutHref(plan.id, interval)}
                        className={`btn ${plan.featured ? "btn-primary" : "btn-ghost"} price-cta glimmer-btn`}
                      >
                        {plan.id === "team" && interval === "monthly"
                          ? `${plan.ctaLabel} — ${priceLabel}/mo`
                          : `${plan.ctaLabel} — ${priceLabel}${
                              price.unitLabel ? ` ${intervalLabel(interval)}` : ""
                            }`}
                      </Link>
                    ) : (
                      <Link
                        href={plan.href || "/signup"}
                        className="btn btn-ghost price-cta glimmer-btn"
                      >
                        {plan.ctaLabel}
                      </Link>
                    )}
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="pricing-trust reveal" data-delay="2">
            <div className="pricing-trust-icons">
              <span>
                <ShieldCheck className="h-4 w-4" aria-hidden /> Secure checkout
              </span>
              <span>
                <Zap className="h-4 w-4" aria-hidden /> Instant workspace
              </span>
              <span>
                <Layers className="h-4 w-4" aria-hidden /> PSN-ready briefs
              </span>
              <span>
                <MonitorSmartphone className="h-4 w-4" aria-hidden /> Live monitors
              </span>
            </div>
            <div className="pricing-glow-line" aria-hidden />
          </div>

          <div className="pricing-pay reveal" data-delay="2">
            <p className="pay-label">Pay with</p>
            <PaymentIcons
              onPick={(label) =>
                goCheckout("team", "monthly", {
                  methodId: ICON_TO_METHOD[label],
                  extras: { source: "payment-icons", icon: label },
                })
              }
            />
            <p className="pay-footnote">
              Crypto via{" "}
              <a href="https://oxapay.com/" target="_blank" rel="noreferrer">
                OxaPay
              </a>
              . Card, PayPal, and crypto share one merchant billing profile.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

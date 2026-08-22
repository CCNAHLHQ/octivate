"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  FileText,
  Lock,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { HeroVideoBackdrop } from "@/components/landing/hero-video-backdrop";
import { OctivateLogo } from "@/components/brand";
import {
  setOptionalAuthUser,
  useOptionalAuth,
} from "@/components/auth/use-optional-auth";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import {
  type PlanDefinition,
  type PlanId,
  canUpgradePlan,
  formatMoney,
  intervalLabel,
  planTierOf,
  resolvePrice,
} from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import "@/app/pricing/pricing.css";
import "@/app/checkout/checkout.css";
import "@/app/upgrade/upgrade.css";

const ease = [0.22, 1, 0.36, 1] as const;

const PLAN_ICONS: Record<PlanId, typeof Sparkles> = {
  free: Sparkles,
  single: FileText,
  team: Users,
  scale: Rocket,
};

type CardState = "current" | "upgrade" | "owned" | "unavailable" | "explore";

function cardStateFor(opts: {
  plan: PlanDefinition;
  currentPlanId: PlanId;
  isOperator: boolean;
  signedIn: boolean;
}): CardState {
  if (opts.isOperator) return "unavailable";
  if (!opts.signedIn) {
    return opts.plan.requiresPayment ? "upgrade" : "explore";
  }
  if (opts.plan.id === opts.currentPlanId) return "current";
  if (planTierOf(opts.plan.id) < planTierOf(opts.currentPlanId)) return "owned";
  if (canUpgradePlan(opts.currentPlanId, opts.plan.id)) return "upgrade";
  return "owned";
}

export function UpgradePage({ initialPlans }: { initialPlans: PlanDefinition[] }) {
  const { user, ready } = useOptionalAuth();
  const [plans, setPlans] = useState(initialPlans);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiFetch<{ user: typeof user }>("/api/auth/me", {
        skipCache: true,
      });
      if (res.user) setOptionalAuthUser(res.user);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void apiFetch<{ plans: PlanDefinition[] }>("/api/pricing", { skipCache: true })
      .then((res) => {
        if (Array.isArray(res.plans) && res.plans.length) setPlans(res.plans);
      })
      .catch(() => undefined);
  }, []);

  /* Real-time plan refresh while this page is open / focused. */
  useEffect(() => {
    if (!ready || !user) return;
    void refreshUser();
    const onFocus = () => void refreshUser();
    const id = window.setInterval(() => void refreshUser(), 8000);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [ready, user?.id, user?.billingPlanId, user?.billingUpdatedAt, refreshUser]);

  const currentPlanId = (user?.billingPlanId || "free") as PlanId;
  const isOperator = user?.role === "operator";
  const signedIn = ready && Boolean(user);

  const currentPlan = useMemo(
    () => plans.find((p) => p.id === currentPlanId) || plans[0],
    [plans, currentPlanId]
  );

  return (
    <div className="upgrade-page">
      <div className="upgrade-hero">
        <div className="upgrade-hero-media" aria-hidden>
          <HeroVideoBackdrop />
          <div className="upgrade-hero-veil" />
        </div>
        <motion.div
          className="upgrade-hero-content"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
        >
          <OctivateLogo variant="lockup" height={40} />
          <p className="upgrade-eyebrow">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Workspace upgrade
          </p>
          <h1>Choose the capacity your programme needs</h1>
          <p className="upgrade-lede">
            {isOperator
              ? "Operator accounts manage the catalogue — plan upgrades are unavailable on this seat."
              : signedIn
                ? `You are on ${currentPlan?.name || "Explore"}${
                    user?.billingInterval
                      ? ` · ${intervalLabel(user.billingInterval)}`
                      : ""
                  }. Upgrade in place without leaving the workspace.`
                : "Sign in to upgrade an existing account, or purchase a new tier from pricing."}
          </p>
          {signedIn && !isOperator ? (
            <p className="upgrade-live" role="status">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Plan status updates in real time after checkout
            </p>
          ) : null}
        </motion.div>
      </div>

      <div className="upgrade-grid pricing-grid">
        <AnimatePresence mode="popLayout">
          {plans.map((plan, i) => {
            const interval = plan.defaultInterval;
            const price = resolvePrice(plan, interval);
            const priceLabel = formatMoney(price.amount);
            const Icon = PLAN_ICONS[plan.id] || Sparkles;
            const state = cardStateFor({
              plan,
              currentPlanId,
              isOperator: Boolean(isOperator),
              signedIn: Boolean(signedIn),
            });
            const checkoutHref = `/checkout?plan=${plan.id}&interval=${interval}`;

            return (
              <motion.article
                key={plan.id}
                className={cn(
                  "price-card upgrade-card",
                  plan.featured && "is-featured",
                  `is-${state}`
                )}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.07, ease }}
                layout
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
                  <span className={cn("upgrade-state-pill", `is-${state}`)}>
                    {state === "current"
                      ? "Current plan"
                      : state === "owned"
                        ? "Already covered"
                        : state === "unavailable"
                          ? "Unavailable"
                          : state === "explore"
                            ? "Free"
                            : "Available"}
                  </span>
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

                <div className="price-foot">
                  {state === "unavailable" ? (
                    <button type="button" className="btn btn-ghost price-cta" disabled>
                      <Lock className="h-4 w-4" aria-hidden />
                      Unavailable for operators
                    </button>
                  ) : state === "current" || state === "owned" ? (
                    <button type="button" className="btn btn-ghost price-cta" disabled>
                      <Check className="h-4 w-4" aria-hidden />
                      {state === "current" ? "Active on this account" : "Included below your tier"}
                    </button>
                  ) : state === "explore" || !plan.requiresPayment ? (
                    <Link href={plan.href || "/signup"} className="btn btn-ghost price-cta glimmer-btn">
                      {plan.ctaLabel}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  ) : (
                    <Link
                      href={
                        signedIn
                          ? checkoutHref
                          : `/signin?next=${encodeURIComponent(checkoutHref)}`
                      }
                      className={cn(
                        "btn price-cta glimmer-btn",
                        plan.featured ? "btn-primary" : "btn-ghost"
                      )}
                      onClick={() => invalidateApiCache("/api/auth/me")}
                    >
                      {signedIn ? "Upgrade to this plan" : "Sign in to upgrade"}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  )}
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

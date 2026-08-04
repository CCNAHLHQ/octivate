/**
 * Billing catalogue — single source of truth for pricing UI + checkout modals.
 * Add plans, intervals, methods, or `meta` fields here without rewriting the modal shell.
 */

export type PlanId = "free" | "single" | "team";
export type BillingInterval = "one_time" | "monthly" | "annual";
export type PaymentMethodId = "stripe" | "paypal" | "card" | "crypto";

export type PlanMeta = Record<string, string | number | boolean | null | undefined>;

export interface PlanPrice {
  amount: number;
  currency: "USD";
  interval: BillingInterval;
  /** Display helper, e.g. "one-time" | "per month" */
  unitLabel: string;
  /** Optional strike / savings copy */
  note?: string;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  badge?: string;
  description: string;
  features: string[];
  accessNote?: { tone: "tide" | "warm"; body: string };
  /** Free tier skips checkout */
  requiresPayment: boolean;
  ctaLabel: string;
  href?: string;
  featured?: boolean;
  /** Allowed billing intervals for this plan */
  intervals: BillingInterval[];
  defaultInterval: BillingInterval;
  prices: Partial<Record<BillingInterval, PlanPrice>>;
  /** Reserved for future product flags / entitlements / experiments */
  meta?: PlanMeta;
}

export interface PaymentMethodDefinition {
  id: PaymentMethodId;
  label: string;
  shortLabel: string;
  description: string;
  logoSrc: string;
  logoAlt: string;
  logoW: number;
  logoH: number;
  logoTone: "brand" | "light";
  enabled: boolean;
  /** Future: provider keys, webhook routes, KYC flags, etc. */
  meta?: PlanMeta;
}

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    description: "Explore the workspace with no card.",
    features: [
      "Open the intelligence workspace and sample briefs",
      "Limited live agent runs — see the eight-stage pipeline",
      "Browse curated Caribbean source packs",
      "No card required",
    ],
    requiresPayment: false,
    ctaLabel: "Start free",
    href: "/signup",
    intervals: ["one_time"],
    defaultInterval: "one_time",
    prices: {
      one_time: {
        amount: 0,
        currency: "USD",
        interval: "one_time",
        unitLabel: "",
      },
    },
    meta: { tier: 0, seats: 1 },
  },
  {
    id: "single",
    name: "Single brief",
    description: "One scoped decision brief, yours permanently.",
    features: [
      "One scoped decision brief — PSN, evidence, gaps, options",
      "Monitoring plan attached so the question stays alive",
      "Optional human analyst review before release",
      "Buy additional briefs as separate one-time scopes",
    ],
    requiresPayment: true,
    ctaLabel: "Get a brief",
    intervals: ["one_time"],
    defaultInterval: "one_time",
    featured: true,
    prices: {
      one_time: {
        amount: 15.99,
        currency: "USD",
        interval: "one_time",
        unitLabel: "one-time",
      },
    },
    meta: { tier: 1, briefs: 1 },
  },
  {
    id: "team",
    name: "Team access",
    badge: "MOST COMPLETE",
    description: "Full workspace for ongoing intelligence work.",
    features: [
      "Full workspace — projects, briefs, monitors, stakeholders, packs",
      "Eight-agent pipeline within operator usage limits",
      "Live monitoring plans as conditions change",
      "Priority analyst review for sensitive briefs",
      "Cancel yourself any time from your account (when accounts ship)",
    ],
    accessNote: {
      tone: "warm",
      body: "Access ends when you cancel. Team access is a subscription, not a purchase. It renews until you cancel. After cancellation, new agent runs pause; briefs already delivered stay in your workspace.",
    },
    requiresPayment: true,
    ctaLabel: "Start team access",
    featured: true,
    intervals: ["monthly"],
    defaultInterval: "monthly",
    prices: {
      monthly: {
        amount: 19.99,
        currency: "USD",
        interval: "monthly",
        unitLabel: "per month",
      },
    },
    meta: { tier: 2, seats: "team" },
  },
];

export const PAYMENT_METHODS: PaymentMethodDefinition[] = [
  {
    id: "stripe",
    label: "Stripe",
    shortLabel: "Stripe",
    description: "Pay securely via Stripe Checkout.",
    logoSrc: "/payments/stripe-white.svg",
    logoAlt: "Stripe",
    logoW: 52,
    logoH: 22,
    logoTone: "brand",
    enabled: true,
    meta: { provider: "stripe", mode: "checkout" },
  },
  {
    id: "paypal",
    label: "PayPal",
    shortLabel: "PayPal",
    description: "Pay with your PayPal balance or linked account.",
    logoSrc: "/payments/paypal-color.svg",
    logoAlt: "PayPal",
    logoW: 22,
    logoH: 22,
    logoTone: "light",
    enabled: true,
    meta: { provider: "paypal" },
  },
  {
    id: "card",
    label: "Credit / debit card",
    shortLabel: "Card",
    description: "Visa, Mastercard, and other major cards.",
    logoSrc: "/payments/visa.svg",
    logoAlt: "Visa",
    logoW: 48,
    logoH: 16,
    logoTone: "light",
    enabled: true,
    meta: { provider: "card", brands: "visa,mastercard" },
  },
  {
    id: "crypto",
    label: "Cryptocurrency",
    shortLabel: "Crypto",
    description: "Pay with Bitcoin, Ethereum, and supported assets.",
    logoSrc: "/payments/bitcoin.svg",
    logoAlt: "Bitcoin",
    logoW: 22,
    logoH: 22,
    logoTone: "light",
    enabled: true,
    meta: { provider: "crypto", assets: "btc,eth" },
  },
];

/** Icons row under pricing (display only). */
export const PAYMENT_DISPLAY_ICONS = [
  { src: "/payments/stripe-white.svg", alt: "Stripe", label: "Stripe", w: 52, h: 22, tone: "brand" as const },
  { src: "/payments/paypal-color.svg", alt: "PayPal", label: "PayPal", w: 22, h: 22, tone: "light" as const },
  { src: "/payments/visa.svg", alt: "Visa", label: "Visa", w: 48, h: 16, tone: "light" as const },
  { src: "/payments/mastercard.svg", alt: "Mastercard", label: "Mastercard", w: 36, h: 22, tone: "light" as const },
  { src: "/payments/bitcoin.svg", alt: "Bitcoin", label: "Bitcoin", w: 22, h: 22, tone: "light" as const },
  { src: "/payments/ethereum.svg", alt: "Ethereum", label: "Ethereum", w: 18, h: 22, tone: "light" as const },
];

export function getPlan(id: PlanId): PlanDefinition {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown plan: ${id}`);
  return plan;
}

export function resolvePrice(
  plan: PlanDefinition,
  interval: BillingInterval
): PlanPrice {
  const price = plan.prices[interval] ?? plan.prices[plan.defaultInterval];
  if (!price) throw new Error(`No price for ${plan.id}/${interval}`);
  return price;
}

export function formatMoney(amount: number, currency: "USD" = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export type CheckoutContext = {
  planId: PlanId;
  interval: BillingInterval;
  methodId?: PaymentMethodId;
  /** Arbitrary future context (promo codes, seats, referral, etc.) */
  extras?: PlanMeta;
};

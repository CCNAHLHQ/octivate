/**
 * Billing catalogue — single source of truth for pricing UI + checkout.
 * Bump CATALOGUE_VERSION when seed plans change so live stores refresh.
 */

export const CATALOGUE_VERSION = 4;

export type PlanId = "free" | "single" | "team" | "scale";
export type BillingInterval = "one_time" | "monthly" | "annual" | "biennial";
export type PaymentMethodId = "stripe" | "paypal" | "card" | "crypto" | "oxapay";

export type PlanMeta = Record<string, string | number | boolean | null | undefined>;

export interface PlanPrice {
  amount: number;
  currency: "USD";
  interval: BillingInterval;
  unitLabel: string;
  note?: string;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  badge?: string;
  description: string;
  features: string[];
  accessNote?: { tone: "tide" | "warm"; body: string };
  requiresPayment: boolean;
  ctaLabel: string;
  href?: string;
  featured?: boolean;
  intervals: BillingInterval[];
  defaultInterval: BillingInterval;
  prices: Partial<Record<BillingInterval, PlanPrice>>;
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
  meta?: PlanMeta;
}

export const ALL_PLAN_IDS: PlanId[] = ["free", "single", "team", "scale"];
export const PAID_PLAN_IDS: PlanId[] = ["single", "team", "scale"];
export const ALL_INTERVALS: BillingInterval[] = [
  "one_time",
  "monthly",
  "annual",
  "biennial",
];

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Explore",
    description: "Open the workspace and taste the doctrine pipeline — no card.",
    features: [
      "Intelligence workspace + sample decision briefs",
      "Limited live agent runs across the eight-stage pipeline",
      "Browse curated Caribbean source packs",
      "Community support",
    ],
    requiresPayment: false,
    ctaLabel: "Start exploring",
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
    meta: {
      tier: 0,
      seats: 1,
      briefs: 0,
      durationLabel: "Ongoing free access",
      catalogueVersion: CATALOGUE_VERSION,
    },
  },
  {
    id: "single",
    name: "Decision brief",
    badge: "ONE SCOPE",
    description:
      "One permanent, scoped decision brief with evidence and options — ideal for a single strategic question.",
    features: [
      "1 scoped brief — PSN, evidence, gaps, and options",
      "Monitoring plan so the question stays alive",
      "Optional human analyst review before release",
      "Duration: one-time purchase · no recurring fee",
      "Buy additional briefs as separate one-time scopes",
    ],
    requiresPayment: true,
    ctaLabel: "Purchase brief",
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
    meta: {
      tier: 1,
      seats: 1,
      briefs: 1,
      durationLabel: "One-time scope",
      catalogueVersion: CATALOGUE_VERSION,
    },
  },
  {
    id: "team",
    name: "Team workspace",
    badge: "FULL ACCESS",
    description:
      "Ongoing agentic intelligence for teams who need the full stack every month.",
    features: [
      "Projects, briefs, monitors, stakeholders, and packs",
      "Up to 12 agent runs / month within operator limits",
      "Live monitoring as conditions change",
      "Priority analyst review for sensitive briefs",
      "Monthly or annual billing · cancel any time when live",
    ],
    accessNote: {
      tone: "warm",
      body: "Subscription renews until you cancel. Delivered briefs remain in your workspace after cancellation; new agent runs pause.",
    },
    requiresPayment: true,
    ctaLabel: "Start Team",
    featured: true,
    intervals: ["monthly", "annual"],
    defaultInterval: "monthly",
    prices: {
      monthly: {
        amount: 19.99,
        currency: "USD",
        interval: "monthly",
        unitLabel: "per month",
      },
      annual: {
        amount: 199,
        currency: "USD",
        interval: "annual",
        unitLabel: "per year",
        note: "Save ~17% vs monthly",
      },
    },
    meta: {
      tier: 2,
      seats: "team",
      briefs: 12,
      durationLabel: "Monthly or annual",
      catalogueVersion: CATALOGUE_VERSION,
    },
  },
  {
    id: "scale",
    name: "Scale",
    badge: "2-YEAR",
    description:
      "Higher throughput and a longer prepaid runway when Team monthly access is not enough.",
    features: [
      "Everything in Team workspace",
      "Up to 50 agent runs / billing period",
      "Multi-seat access for extended engagements",
      "Priority fulfilment and analyst review",
      "Annual or 2-year prepaid commitment",
    ],
    accessNote: {
      tone: "tide",
      body: "Prepaid for 12 or 24 months. Unused runs do not roll over after the commitment ends.",
    },
    requiresPayment: true,
    ctaLabel: "Get Scale",
    featured: true,
    intervals: ["annual", "biennial"],
    defaultInterval: "biennial",
    prices: {
      annual: {
        amount: 249,
        currency: "USD",
        interval: "annual",
        unitLabel: "per year",
      },
      biennial: {
        amount: 399,
        currency: "USD",
        interval: "biennial",
        unitLabel: "per 2 years",
        note: "Best value vs two annuals",
      },
    },
    meta: {
      tier: 3,
      seats: "programme",
      briefs: 50,
      durationLabel: "1–2 years",
      catalogueVersion: CATALOGUE_VERSION,
    },
  },
];

export const PAYMENT_METHODS: PaymentMethodDefinition[] = [
  {
    id: "card",
    label: "Credit card",
    shortLabel: "Credit card",
    description: "Visa and Mastercard.",
    logoSrc: "/payments/visa.svg",
    logoAlt: "Visa and Mastercard",
    logoW: 72,
    logoH: 24,
    logoTone: "light",
    enabled: true,
    meta: { provider: "card", brands: "visa,mastercard" },
  },
  {
    id: "paypal",
    label: "PayPal",
    shortLabel: "PayPal",
    description: "Pay with your PayPal balance or linked account.",
    logoSrc: "/payments/paypal-color.svg",
    logoAlt: "PayPal",
    logoW: 80,
    logoH: 24,
    logoTone: "light",
    enabled: true,
    meta: { provider: "paypal" },
  },
  {
    id: "oxapay",
    label: "Cryptocurrency",
    shortLabel: "Cryptocurrency",
    description: "Pay with BTC, ETH, USDT and more (OxaPay settlement).",
    logoSrc: "/payments/bitcoin.svg",
    logoAlt: "Cryptocurrency",
    logoW: 60,
    logoH: 24,
    logoTone: "light",
    enabled: true,
    meta: { provider: "oxapay", docs: "https://oxapay.com/" },
  },
  {
    id: "stripe",
    label: "Stripe",
    shortLabel: "Stripe",
    description: "Removed from public checkout.",
    logoSrc: "/payments/stripe.svg",
    logoAlt: "Stripe",
    logoW: 60,
    logoH: 24,
    logoTone: "brand",
    enabled: false,
    meta: { provider: "stripe", mode: "checkout" },
  },
  {
    id: "crypto",
    label: "Cryptocurrency",
    shortLabel: "Cryptocurrency",
    description: "Alias — routes through OxaPay merchant checkout.",
    logoSrc: "/payments/bitcoin.svg",
    logoAlt: "Bitcoin",
    logoW: 60,
    logoH: 24,
    logoTone: "light",
    enabled: false,
    meta: { provider: "oxapay", alias: true, assets: "btc,eth,usdt" },
  },
];

export const PAYMENT_DISPLAY_ICONS = [
  {
    src: "/payments/paypal-color.svg",
    alt: "PayPal",
    label: "PayPal",
    w: 56,
    h: 16,
    tone: "light" as const,
  },
  { src: "/payments/visa.svg", alt: "Visa", label: "Visa", w: 48, h: 16, tone: "light" as const },
  {
    src: "/payments/mastercard.svg",
    alt: "Mastercard",
    label: "Mastercard",
    w: 36,
    h: 22,
    tone: "light" as const,
  },
  {
    src: "/payments/bitcoin.svg",
    alt: "Cryptocurrency",
    label: "Cryptocurrency",
    w: 22,
    h: 22,
    tone: "light" as const,
  },
  {
    src: "/payments/ethereum.svg",
    alt: "Ethereum",
    label: "Ethereum",
    w: 18,
    h: 22,
    tone: "light" as const,
  },
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

export function planTierOf(planId?: PlanId | null): number {
  if (!planId) return 0;
  const hit = PLANS.find((p) => p.id === planId);
  return Number(hit?.meta?.tier ?? 0) || 0;
}

export function canUpgradePlan(
  currentPlanId: PlanId | null | undefined,
  targetPlanId: PlanId
): boolean {
  if (targetPlanId === "free") return false;
  return planTierOf(targetPlanId) > planTierOf(currentPlanId || "free");
}

export function intervalLabel(interval: BillingInterval): string {
  switch (interval) {
    case "one_time":
      return "one-time";
    case "monthly":
      return "monthly";
    case "annual":
      return "annual";
    case "biennial":
      return "2-year";
    default:
      return interval;
  }
}

export type CheckoutContext = {
  planId: PlanId;
  interval: BillingInterval;
  methodId?: PaymentMethodId;
  extras?: PlanMeta;
};

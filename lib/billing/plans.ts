/**
 * Billing catalogue — single source of truth for pricing UI + checkout.
 * Bump CATALOGUE_VERSION when seed plans change so live stores refresh.
 */

export const CATALOGUE_VERSION = 2;

export type PlanId = "free" | "single" | "team";
export type BillingInterval = "one_time" | "monthly" | "annual";
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
    meta: { tier: 0, seats: 1, catalogueVersion: CATALOGUE_VERSION },
  },
  {
    id: "single",
    name: "Decision brief",
    badge: "ONE SCOPE",
    description: "One permanent, scoped decision brief with evidence and options.",
    features: [
      "One scoped brief — PSN, evidence, gaps, and options",
      "Monitoring plan so the question stays alive",
      "Optional human analyst review before release",
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
    meta: { tier: 1, briefs: 1, catalogueVersion: CATALOGUE_VERSION },
  },
  {
    id: "team",
    name: "Team workspace",
    badge: "FULL ACCESS",
    description: "Ongoing agentic intelligence for teams who need the full stack.",
    features: [
      "Projects, briefs, monitors, stakeholders, and packs",
      "Eight-agent pipeline within operator usage limits",
      "Live monitoring as conditions change",
      "Priority analyst review for sensitive briefs",
      "Cancel any time from your account when billing is live",
    ],
    accessNote: {
      tone: "warm",
      body: "Subscription renews until you cancel. Delivered briefs remain in your workspace after cancellation; new agent runs pause.",
    },
    requiresPayment: true,
    ctaLabel: "Start team access",
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
    meta: { tier: 2, seats: "team", catalogueVersion: CATALOGUE_VERSION },
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
    logoW: 60,
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
  { src: "/payments/paypal-color.svg", alt: "PayPal", label: "PayPal", w: 22, h: 22, tone: "light" as const },
  { src: "/payments/visa.svg", alt: "Visa", label: "Visa", w: 48, h: 16, tone: "light" as const },
  { src: "/payments/mastercard.svg", alt: "Mastercard", label: "Mastercard", w: 36, h: 22, tone: "light" as const },
  { src: "/payments/bitcoin.svg", alt: "Cryptocurrency", label: "Cryptocurrency", w: 22, h: 22, tone: "light" as const },
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
  extras?: PlanMeta;
};

import {
  formatMoney,
  resolvePrice,
  type PlanDefinition,
} from "@/lib/billing/plans";
import { readBillingPlans } from "@/lib/billing/plans-store";

export type MailIntent = "invite" | "transactional";

export type MailFeatureCard = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  accent: "violet" | "tide" | "coral";
  iconCid?: string;
  iconSrc?: string;
};

export type MailPricingCard = {
  id: string;
  name: string;
  priceLabel: string;
  unitLabel: string;
  description: string;
  featured?: boolean;
  badge?: string;
};

export const MAIL_ICON_CIDS = {
  brief: "octivate-icon-brief@octivate",
  monitor: "octivate-icon-monitor@octivate",
  team: "octivate-icon-team@octivate",
} as const;

/** Tutorial-inspired presentation cards for invite mail. */
export function defaultInviteFeatureCards(siteUrl: string): MailFeatureCard[] {
  const site = siteUrl.replace(/\/$/, "");
  return [
    {
      id: "brief",
      kicker: "01 · Briefs",
      title: "Evidence-backed judgement",
      body: "Turn a live operating question into a Power–Systems–Narratives brief with sources, gaps, and options your team can act on.",
      accent: "violet",
      iconCid: MAIL_ICON_CIDS.brief,
      iconSrc: `${site}/email/icons/icon-brief.png`,
    },
    {
      id: "monitor",
      kicker: "02 · Monitors",
      title: "Keep the question alive",
      body: "Attach monitoring so Caribbean conditions stay in view after the first brief — not a static PDF that ages out overnight.",
      accent: "tide",
      iconCid: MAIL_ICON_CIDS.monitor,
      iconSrc: `${site}/email/icons/icon-monitor.png`,
    },
    {
      id: "workspace",
      kicker: "03 · Workspace",
      title: "One place for the work",
      body: "Projects, stakeholders, source packs, and support sit in one workspace — built for complex Caribbean operating environments.",
      accent: "coral",
      iconCid: MAIL_ICON_CIDS.team,
      iconSrc: `${site}/email/icons/icon-team.png`,
    },
  ];
}

export function defaultInviteCopy(greetingName?: string) {
  const name = greetingName?.trim() || "";
  const hi = name ? `Hi ${name},` : "Hello,";
  return {
    subject: "You're invited to Octivate",
    preheader: "Clarity for the decisions that shape the Caribbean — start free, or book a short demo.",
    eyebrow: "Invitation",
    headline: name ? undefined : "You're invited to Octivate",
    text: [
      hi,
      "",
      "Octivate is the decision-intelligence workspace from CENSII — built so Caribbean teams can move from scattered signals to evidence-backed judgement without drowning in slideware.",
      "",
      "We'd like you to see it on a question that matters to you. Start free in the workspace, open a sample brief, or request a short walkthrough with our team.",
    ].join("\n"),
    ctaLabel: "Request a demo",
    ctaPath: "/#contact",
    secondaryLabel: "See a sample brief",
    secondaryPath: "/sample/brief",
    recipientNote:
      "You're receiving this invitation from Octivate. If it wasn't meant for you, you can ignore this email or update mailing preferences below.",
    signOff: "Octivate",
    signOffRole: "CENSII · Decision intelligence for the Caribbean",
  };
}

/** Map live billing catalogue into compact email pricing cards. */
export function plansToMailPricing(plans: PlanDefinition[]): MailPricingCard[] {
  return plans.slice(0, 3).map((plan) => {
    const price = resolvePrice(plan, plan.defaultInterval);
    const priceLabel =
      price.amount === 0 ? formatMoney(0) : formatMoney(price.amount);
    let unitLabel = "";
    if (price.amount === 0) unitLabel = "to explore";
    else if (price.interval === "monthly") unitLabel = "/ month";
    else if (price.unitLabel) unitLabel = price.unitLabel;
    return {
      id: plan.id,
      name: plan.name,
      priceLabel,
      unitLabel,
      description: plan.description,
      featured: Boolean(plan.featured && plan.id === "team"),
      badge: plan.badge,
    };
  });
}

export async function loadMailPricingCards(): Promise<MailPricingCard[]> {
  try {
    const plans = await readBillingPlans();
    return plansToMailPricing(plans);
  } catch {
    return [];
  }
}

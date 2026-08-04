import type { LucideIcon } from "lucide-react";
import {
  Bug,
  Database,
  DollarSign,
  FileOutput,
  LifeBuoy,
  Mail,
  Shield,
  SlidersHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import type { IntroStep } from "@/lib/onboarding/content";

export const OPERATOR_INTRO_VERSION = "v2";
export const OPERATOR_INTRO_STORAGE_KEY = `octivate-operator-intro-${OPERATOR_INTRO_VERSION}`;
export const OPERATOR_INTRO_EVENT = "octivate:open-operator-intro";

/** Brief tour of operator console tabs — hash routes stay on /dashboard/operator. */
export const OPERATOR_INTRO_STEPS: IntroStep[] = [
  {
    id: "pulse",
    kicker: "Step 1 · Pulse",
    title: "Start on",
    titleAccent: "Pulse",
    tagline: "Live health of the production pipeline.",
    description:
      "Pulse is the operator home. Scan session health, token burn, and review queues before diving into deeper controls.",
    bullets: [
      { lead: "KPIs", text: "show tokens, agents, and review load" },
      { lead: "Hash tabs", text: "jump any console section instantly" },
    ],
    icon: Shield,
    art: "overview",
    accent: "violet",
    route: "/dashboard/operator#pulse",
    target: "[data-tour='op-tab-pulse']",
    demo: "highlight",
    requireSidebar: true,
  },
  {
    id: "operations",
    kicker: "Step 2 · Operations",
    title: "Clear and",
    titleAccent: "moderate",
    tagline: "Session cleanup and compliance actions.",
    description:
      "Operations covers destructive maintenance — pruning stuck sessions and handling moderation queues when something goes wrong.",
    bullets: [
      { lead: "Use sparingly", text: "actions here affect live production state" },
      { lead: "Audit", text: "events land in Debug for forensics" },
    ],
    icon: Trash2,
    art: "pipeline",
    accent: "amber",
    route: "/dashboard/operator#operations",
    target: "[data-tour='op-tab-operations']",
    demo: "highlight",
    requireSidebar: true,
  },
  {
    id: "control",
    kicker: "Step 3 · Control",
    title: "Tune platform",
    titleAccent: "limits",
    tagline: "Tokens, uploads, avatars, and review policy.",
    description:
      "Control sets runtime caps: daily tokens, concurrent agents, upload size, avatar KB, bio length, and human-review policy. Changes autosave.",
    bullets: [
      { lead: "Account profile", text: "avatar KB + bio chars for members" },
      { lead: "Policy toggles", text: "premium models and required review" },
    ],
    icon: SlidersHorizontal,
    art: "projects",
    accent: "teal",
    route: "/dashboard/operator#control",
    target: "[data-tour='op-tab-control']",
    demo: "highlight",
    requireSidebar: true,
  },
  {
    id: "catalog",
    kicker: "Step 4 · Catalog",
    title: "Sources and",
    titleAccent: "signals",
    tagline: "Import and curate evidence inputs.",
    description:
      "Catalog manages source packs and imports that feed monitors and doctrine runs. Keep provenance clean before briefs ship.",
    bullets: [
      { lead: "Import", text: "adds curated regional sources" },
      { lead: "Quality in", text: "quality out for downstream briefs" },
    ],
    icon: Database,
    art: "monitors",
    accent: "teal",
    route: "/dashboard/operator#catalog",
    target: "[data-tour='op-tab-catalog']",
    demo: "highlight",
    requireSidebar: true,
  },
  {
    id: "support",
    kicker: "Step 5 · Customer Support",
    title: "Staff",
    titleAccent: "Customer Support",
    tagline: "Live customer threads with safe previews.",
    description:
      "Customer Support is the founder inbox. Reply in-thread, preview attachments in-browser, and never download untrusted files locally.",
    bullets: [
      { lead: "Live stream", text: "keeps threads current under load" },
      { lead: "Avatars", text: "identify Shemuel, Nirvana, and Jaden" },
    ],
    icon: LifeBuoy,
    art: "support",
    accent: "violet",
    route: "/dashboard/operator#support",
    target: "[data-tour='op-tab-support']",
    demo: "highlight",
    requireSidebar: true,
  },
  {
    id: "mail",
    kicker: "Step 6 · Mail",
    title: "Send from your",
    titleAccent: "account",
    tagline: "Mailing list + Haraka outbound.",
    description:
      "Mail composes to subscribers with the default HTML template. Your signed-in address is the preferred From; list recipients come from the landing mailing list.",
    bullets: [
      { lead: "From", text: "defaults to your operator email" },
      { lead: "Debug", text: "captures Haraka warnings and errors" },
    ],
    icon: Mail,
    art: "briefs",
    accent: "amber",
    route: "/dashboard/operator#mail",
    target: "[data-tour='op-tab-mail']",
    demo: "highlight",
    requireSidebar: true,
  },
  {
    id: "users",
    kicker: "Step 7 · Users",
    title: "See members",
    titleAccent: "and bios",
    tagline: "Counts, disable, and password resets.",
    description:
      "Users shows registration mix, mailing activity, avatars, and descriptions. Founder operators stay protected from disable/reset here.",
    bullets: [
      { lead: "Reset password", text: "copies a one-time secret" },
      { lead: "Founders", text: "cannot be moderated in this panel" },
    ],
    icon: Users,
    art: "overview",
    accent: "teal",
    route: "/dashboard/operator#users",
    target: "[data-tour='op-tab-users']",
    demo: "highlight",
    requireSidebar: true,
  },
  {
    id: "pricing",
    kicker: "Step 8 · Pricing",
    title: "Edit plan",
    titleAccent: "copy",
    tagline: "Public pricing cards and notes.",
    description:
      "Pricing updates the live plans shown on the marketing site. Keep amounts and feature notes accurate before publishing.",
    bullets: [
      { lead: "Autosave", text: "writes to billing plans storage" },
      { lead: "Public page", text: "reads the same source of truth" },
    ],
    icon: DollarSign,
    art: "projects",
    accent: "violet",
    route: "/dashboard/operator#pricing",
    target: "[data-tour='op-tab-pricing']",
    demo: "highlight",
    requireSidebar: true,
  },
  {
    id: "exports",
    kicker: "Step 9 · Exports",
    title: "Shape brief",
    titleAccent: "templates",
    tagline: "HTML export layouts for stakeholders.",
    description:
      "Exports lets you design, preview, and upload HTML templates used when briefs leave the platform as packs.",
    bullets: [
      { lead: "Preview", text: "renders against a sample brief" },
      { lead: "Upload", text: "accepts styled HTML packages" },
    ],
    icon: FileOutput,
    art: "briefs",
    accent: "amber",
    route: "/dashboard/operator#exports",
    target: "[data-tour='op-tab-exports']",
    demo: "highlight",
    requireSidebar: true,
  },
  {
    id: "debug",
    kicker: "Step 10 · Debug",
    title: "Watch the",
    titleAccent: "live console",
    tagline: "OpenRouter, pipeline, mail, and security events.",
    description:
      "Debug streams ops events. Filter by Mail when testing SMTP, or Security after password/avatar changes. Clear only when you mean it.",
    bullets: [
      { lead: "Mail source", text: "shows Haraka warn/error payloads" },
      { lead: "Replay", text: "this tour anytime from Operator Tutorial" },
    ],
    icon: Bug,
    art: "pipeline",
    accent: "violet",
    route: "/dashboard/operator#debug",
    target: "[data-tour='op-tab-debug']",
    demo: "pulse",
    requireSidebar: true,
  },
];

export type { LucideIcon };

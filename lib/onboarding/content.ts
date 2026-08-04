import type { LucideIcon } from "lucide-react";
import {
  Activity,
  FileText,
  FolderKanban,
  Headphones,
  LayoutDashboard,
  Sparkles,
} from "lucide-react";

export type IntroBullet = {
  lead?: string;
  text: string;
};

export type IntroDemo = "highlight" | "pulse" | "navigate";

export type IntroArtKind =
  | "overview"
  | "projects"
  | "pipeline"
  | "briefs"
  | "monitors"
  | "support";

/** Shown once on first dashboard visit — browser-style tour. */
export type IntroStep = {
  id: string;
  kicker: string;
  title: string;
  titleAccent?: string;
  tagline?: string;
  description: string;
  bullets: IntroBullet[];
  icon: LucideIcon;
  art: IntroArtKind;
  accent: "violet" | "teal" | "amber";
  route?: string;
  target?: string;
  demo?: IntroDemo;
  /** Open the workspace sidebar so nav targets are visible. */
  requireSidebar?: boolean;
  /** Navigate into the first available project before spotlighting. */
  resolveProject?: boolean;
};

export const WORKSPACE_INTRO_VERSION = "v6";
export const WORKSPACE_INTRO_STORAGE_KEY = `octivate-workspace-intro-${WORKSPACE_INTRO_VERSION}`;

export const WORKSPACE_INTRO_STEPS: IntroStep[] = [
  {
    id: "welcome",
    kicker: "Step 1 · Overview",
    title: "Start from your",
    titleAccent: "workspace home",
    tagline: "Briefs, projects, and usage in one place.",
    description:
      "Overview is home base for Caribbean decision work. Use the sidebar to move between Projects, Briefs, Monitors, and live Support.",
    bullets: [
      { lead: "Sidebar", text: "jumps Overview, Projects, Briefs, and Monitors" },
      { lead: "Ask question", text: "opens a project theatre in one click" },
      { lead: "Replay", text: "this tour anytime from Workspace Tutorial" },
    ],
    icon: LayoutDashboard,
    art: "overview",
    accent: "violet",
    route: "/dashboard",
    target: "[data-tour='nav-overview']",
    demo: "highlight",
    requireSidebar: true,
  },
  {
    id: "projects",
    kicker: "Step 2 · Projects",
    title: "Create a",
    titleAccent: "decision theatre",
    tagline: "One project = one strategic thread.",
    description:
      "Open Projects and start a new theatre with country, sector, and a question. Upload documents before you run agents when you have proprietary context.",
    bullets: [
      { lead: "New project", text: "opens the create flow" },
      { lead: "Each project", text: "keeps its own question, docs, and runs" },
      { lead: "Sign-in guests", text: "can explore the workspace freely on demo access" },
    ],
    icon: FolderKanban,
    art: "projects",
    accent: "teal",
    route: "/dashboard/projects",
    target: "[data-tour='projects-new']",
    demo: "pulse",
    requireSidebar: true,
  },
  {
    id: "pipeline",
    kicker: "Step 3 · Run",
    title: "Open a project,",
    titleAccent: "then run",
    tagline: "Start a theatre first — then ask and run.",
    description:
      "If you do not have a project yet, use Start a new project. Inside an existing theatre, write a strategic question and run the Power–Systems–Narratives pipeline.",
    bullets: [
      { lead: "New project", text: "creates a decision theatre for this tour" },
      { lead: "Question", text: "loads starters or your own prompt" },
      { lead: "Run", text: "starts the live OpenRouter pipeline" },
    ],
    icon: Sparkles,
    art: "pipeline",
    accent: "violet",
    route: "/dashboard/projects",
    target: "[data-tour='projects-new']",
    demo: "pulse",
    resolveProject: true,
    requireSidebar: true,
  },
  {
    id: "briefs",
    kicker: "Step 4 · Briefs",
    title: "Open the",
    titleAccent: "decision brief",
    tagline: "Recommendations, evidence, and gaps.",
    description:
      "Successful runs land in Briefs. Open a brief to review judgement, evidence, monitoring plans, and export a shareable pack for stakeholders.",
    bullets: [
      { lead: "Briefs nav", text: "lists every completed decision pack" },
      { lead: "Exports", text: "produce branded Word / PDF for stakeholders" },
      { lead: "Sample brief", text: "is also linked from the public landing page" },
    ],
    icon: FileText,
    art: "briefs",
    accent: "amber",
    route: "/dashboard/briefs",
    target: "[data-tour='nav-briefs']",
    demo: "highlight",
    requireSidebar: true,
  },
  {
    id: "monitors",
    kicker: "Step 5 · Monitors",
    title: "Watch signals",
    titleAccent: "between runs",
    tagline: "Keyword and jurisdiction watches.",
    description:
      "Monitors keep an eye on topics across Caribbean jurisdictions while you work. Create them from Monitors and check alerts between brief cycles.",
    bullets: [
      { lead: "Create", text: "a watch from the Monitors toolbar" },
      { lead: "Jurisdictions", text: "mirror the coverage marquee on the public site" },
      { lead: "Return here", text: "when you need a full analysis run again" },
    ],
    icon: Activity,
    art: "monitors",
    accent: "teal",
    route: "/dashboard/monitors",
    target: "[data-tour='nav-monitors']",
    demo: "highlight",
    requireSidebar: true,
  },
  {
    id: "ready",
    kicker: "Step 6 · Support",
    title: "Need a hand?",
    titleAccent: "Ask anytime",
    tagline: "Live Octivate Support from the chat button.",
    description:
      "The floating Help chat reaches the CENSII support team for access, briefs, demos, plans, and product questions. Replies stream live as the team responds.",
    bullets: [
      { lead: "Help chat", text: "opens a live support thread with staff avatars" },
      { lead: "Quick topics", text: "cover briefs, projects, demos, and plans" },
      { lead: "Replay tour", text: "anytime from Workspace Tutorial in the sidebar" },
    ],
    icon: Headphones,
    art: "support",
    accent: "violet",
    route: "/dashboard",
    target: "[data-tour='support-help']",
    demo: "pulse",
  },
];

export const WORKSPACE_INTRO_EVENT = "octivate:open-workspace-intro";
export const WORKSPACE_TOUR_SIDEBAR_EVENT = "octivate:tour-open-sidebar";

export const WORKSPACE_INTRO_PREFETCH_ROUTES = [
  "/dashboard",
  "/dashboard/projects",
  "/dashboard/briefs",
  "/dashboard/monitors",
] as const;

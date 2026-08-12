import type { LucideIcon } from "lucide-react";
import {
  Activity,
  FileText,
  FolderKanban,
  Headphones,
  Languages,
  LayoutDashboard,
  MapPinned,
  Scale,
  Sparkles,
  SunMoon,
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
  | "support"
  | "map"
  | "translate"
  | "theme"
  | "legal";

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

export const WORKSPACE_INTRO_VERSION = "v7";
export const WORKSPACE_INTRO_STORAGE_KEY = `octivate-workspace-intro-${WORKSPACE_INTRO_VERSION}`;

export const WORKSPACE_INTRO_STEPS: IntroStep[] = [
  {
    id: "welcome",
    kicker: "Step 1 · Overview",
    title: "Start from your",
    titleAccent: "workspace home",
    tagline: "Briefs, projects, coverage, and usage in one place.",
    description:
      "Overview is home base for Caribbean decision work. Use the sidebar to move between Projects, Briefs, Monitors, and live Support — plus the Theatre coverage map for geographic context.",
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
    id: "coverage",
    kicker: "Step 2 · Theatre coverage",
    title: "See the",
    titleAccent: "Theatre coverage map",
    tagline: "Live Caribbean project geography on Overview.",
    description:
      "The Theatre coverage map sits on Overview. Hotspots show where projects live; hover for counts, click a country to open the project list, and use Live / Updating when the workspace refreshes.",
    bullets: [
      { lead: "Hotspots", text: "size by project count across jurisdictions" },
      { lead: "Click", text: "opens a modal of projects for that country" },
      { lead: "Live", text: "pulses when coverage data refreshes" },
    ],
    icon: MapPinned,
    art: "map",
    accent: "teal",
    route: "/dashboard",
    target: "[data-tour='overview-map']",
    demo: "pulse",
  },
  {
    id: "projects",
    kicker: "Step 3 · Projects",
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
    kicker: "Step 4 · Run",
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
    kicker: "Step 5 · Briefs",
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
    kicker: "Step 6 · Monitors",
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
    id: "translate",
    kicker: "Step 7 · Translation",
    title: "Switch",
    titleAccent: "language anytime",
    tagline: "Realtime catalogs from the site language control.",
    description:
      "Octivate uses permanent i18n catalogs — pick a locale from the public site language control and chrome updates immediately. No third-party page-translation widget.",
    bullets: [
      { lead: "Languages", text: "cover Caribbean and global demo locales" },
      { lead: "Catalogs", text: "sync from OpenRouter and cache on the server" },
      { lead: "Public chrome", text: "hosts the language picker on marketing pages" },
    ],
    icon: Languages,
    art: "translate",
    accent: "violet",
    route: "/dashboard",
    demo: "highlight",
  },
  {
    id: "lighting",
    kicker: "Step 8 · Lighting",
    title: "Set your",
    titleAccent: "lighting",
    tagline: "Light or dark — same product language.",
    description:
      "Lighting toggles light and dark themes across Overview, projects, and chrome. Use the sun / moon control on the public site navbar or footer — whichever keeps maps and briefs comfortable.",
    bullets: [
      { lead: "Toggle", text: "switches sun / moon lighting instantly" },
      { lead: "Maps", text: "follow the active theme for tile contrast" },
      { lead: "Preference", text: "stays with your browser session" },
    ],
    icon: SunMoon,
    art: "theme",
    accent: "amber",
    route: "/dashboard",
    demo: "highlight",
  },
  {
    id: "support",
    kicker: "Step 9 · Support alerts",
    title: "Need a hand?",
    titleAccent: "Help + alerts",
    tagline: "Live member Support with reply alerts.",
    description:
      "Workspace members use the floating Help chat — not the operator inbox. When staff reply, Octivate can surface support alerts so you do not miss the thread. Operators answer from Customer Support instead.",
    bullets: [
      { lead: "Help chat", text: "opens your account support thread" },
      { lead: "Alerts", text: "notify you when the team responds" },
      { lead: "Quick topics", text: "cover briefs, projects, demos, and plans" },
    ],
    icon: Headphones,
    art: "support",
    accent: "violet",
    route: "/dashboard",
    target: "[data-tour='support-help']",
    demo: "pulse",
  },
  {
    id: "legal",
    kicker: "Step 10 · Legal",
    title: "Privacy Policy",
    titleAccent: "& Terms of Service",
    tagline: "Open either page from the sidebar footer.",
    description:
      "Privacy Policy and Terms of Service live in the sidebar footer. Click either link anytime to open the full public page.",
    bullets: [
      { lead: "Privacy Policy", text: "covers data use and cookies context" },
      { lead: "Terms of Service", text: "cover platform use and accounts" },
      { lead: "Sidebar footer", text: "keeps both links one click away" },
    ],
    icon: Scale,
    art: "legal",
    accent: "teal",
    route: "/dashboard",
    target: "[data-tour='legal-notice']",
    demo: "highlight",
    requireSidebar: true,
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

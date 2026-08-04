import type {
  Brief,
  CostEntry,
  CountryPack,
  MarqueeItem,
  Monitor,
  OperatorLimits,
  Project,
  Source,
  Stakeholder,
  Trend,
  UsageSnapshot,
} from "@/lib/types";

export const SEED_PROJECTS: Project[] = [
  {
    id: "proj_tt_ai_governance",
    name: "AI governance in Trinidad & Tobago",
    country: "Trinidad & Tobago",
    sector: "Artificial Intelligence",
    question:
      "Given Trinidad and Tobago's National AI Governance Framework work with UNESCO RAM and UNDP AILA, what are the principal political, regulatory, and institutional risks and opportunities for deploying AI in public services through 2027 — and which decisions should operators lock now versus defer?",
    documents: [
      {
        id: "doc_ai_1",
        name: "MPAAI-national-AI-initiatives.md",
        type: "Markdown",
        uploadedAt: "2026-07-20T10:00:00Z",
      },
      {
        id: "doc_ai_2",
        name: "UNESCO-AI-readiness-Trinidad.md",
        type: "Markdown",
        uploadedAt: "2026-07-21T09:00:00Z",
      },
      {
        id: "doc_ai_3",
        name: "UWI-RAM-validation-workshop.md",
        type: "Markdown",
        uploadedAt: "2026-07-22T11:00:00Z",
      },
    ],
    createdAt: "2026-07-20T10:00:00Z",
    updatedAt: "2026-07-24T12:00:00Z",
    status: "active",
  },
  {
    id: "proj_guyana_energy",
    name: "Guyana Energy Entry",
    country: "Guyana",
    sector: "Energy",
    question: "What are the political and regulatory risks for a midstream LNG investment in Guyana through 2028?",
    documents: [
      { id: "doc_1", name: "EPA-guidelines-2024.pdf", type: "PDF", uploadedAt: "2026-07-10T12:00:00Z" },
      { id: "doc_2", name: "local-content-act.md", type: "Markdown", uploadedAt: "2026-07-12T09:30:00Z" },
    ],
    createdAt: "2026-07-08T10:00:00Z",
    updatedAt: "2026-07-18T14:20:00Z",
    status: "active",
  },
];

export const SEED_BRIEFS: Brief[] = [
  {
    id: "brief_001",
    projectId: "proj_guyana_energy",
    title: "Guyana midstream LNG — regulatory & political risk",
    country: "Guyana",
    sector: "Energy",
    executiveSummary:
      "Guyana's oil boom creates attractive midstream opportunities, but local-content rules, EPA permitting timelines, and coalition politics introduce medium-high execution risk through 2028. Evidence quality is strong on fiscal regime; weaker on contractor capacity and community consent.",
    confidence: 78,
    recommendations: [
      "Sequence FID behind confirmed EPA pathway and local-content compliance plan",
      "Map contractor capacity with Tier-1 and Tier-2 sources before partner selection",
      "Stand up monitoring on Gazette notices and parliamentary energy committee output",
    ],
    gaps: [
      "Limited independent verification of local fabricator capacity (Source 1)",
      "Sparse recent community impact assessments for proposed corridor",
    ],
    power: ["Office of the President", "EPA Guyana", "ExxonMobil consortium", "Opposition parties"],
    systems: ["Petroleum fiscal regime", "Local Content Act", "EPA permitting", "CARICOM energy dialogue"],
    narratives: ["Resource nationalism", "Dutch disease caution", "Energy transition vs hydrocarbon window"],
    riskLevel: "high",
    createdAt: "2026-07-18T14:20:00Z",
    status: "final",
    analysisDepth: "standard",
    reviewStatus: "approved",
    depthDisclaimer: "Standard draft — balanced PSN analysis pending human review.",
    citedSources: [
      {
        id: "src_1",
        label: "Source 1",
        title: "Guyana Official Gazette",
        url: "https://officialgazette.gov.gy",
        snippet: "Official notices on petroleum, local content, and permitting.",
        passageCount: 3,
      },
      {
        id: "src_2",
        label: "Source 2",
        title: "IMF Article IV — Guyana",
        url: "https://www.imf.org",
        snippet: "Fiscal regime and macro outlook relevant to midstream investment timing.",
        passageCount: 2,
      },
    ],
  },
  {
    id: "brief_002",
    projectId: "proj_tt_ai_governance",
    title: "T&T AI governance — public-service deployment risks",
    country: "Trinidad & Tobago",
    sector: "Artificial Intelligence",
    executiveSummary:
      "Trinidad and Tobago's UNESCO RAM / national AI framework work creates a window to lock governance decisions for public-service AI through 2027, but institutional capacity, data-protection sequencing, and legitimacy narratives remain under-specified.",
    confidence: 71,
    recommendations: [
      "Lock data-protection sequencing before high-stakes public AI pilots",
      "Pair MPAAI coordination with independent audit capacity for high-risk systems",
      "Publish a citizen-facing legitimacy narrative alongside technical standards",
    ],
    gaps: [
      "Incomplete mapping of agency AI pilots already in flight",
      "Sparse evidence on enforcement capacity for algorithmic accountability",
    ],
    power: ["MPAAI", "Office of the Prime Minister", "Data protection authority", "UWI / academic validators"],
    systems: ["UNESCO RAM process", "Public procurement for AI systems", "National data infrastructure"],
    narratives: ["Modernisation vs surveillance anxiety", "Caribbean AI leadership", "Job displacement caution"],
    riskLevel: "medium",
    createdAt: "2026-07-24T12:00:00Z",
    status: "draft",
    analysisDepth: "standard",
    reviewStatus: "pending_review",
  },
];

export const SEED_MONITORS: Monitor[] = [
  {
    id: "mon_1",
    name: "Guyana EPA + Gazette",
    keywords: ["EPA", "petroleum", "local content", "Gazette", "energy"],
    countries: ["Guyana"],
    status: "active",
    lastAlertAt: "2026-07-19T06:12:00Z",
    alertCount: 4,
    projectId: "proj_guyana_energy",
  },
  {
    id: "mon_2",
    name: "CARICOM energy",
    keywords: ["CARICOM", "energy security", "LNG"],
    countries: ["CARICOM"],
    status: "active",
    alertCount: 1,
  },
  {
    id: "mon_3",
    name: "Barbados tourism arrivals",
    keywords: ["BTMI", "tourism", "cruise"],
    countries: ["Barbados"],
    status: "paused",
    alertCount: 0,
  },
];

export const SEED_SOURCES: Source[] = [
  {
    id: "src_1",
    title: "Guyana Official Gazette",
    tier: 1,
    country: "Guyana",
    type: "Government",
    health: "healthy",
    lastChecked: "2026-07-20T10:00:00Z",
  },
  {
    id: "src_2",
    title: "IMF Article IV — Guyana",
    tier: 2,
    country: "Guyana",
    type: "IO",
    health: "healthy",
    lastChecked: "2026-07-20T09:00:00Z",
  },
  {
    id: "src_3",
    title: "Stabroek News",
    tier: 3,
    country: "Guyana",
    type: "Media",
    health: "degraded",
    lastChecked: "2026-07-20T08:30:00Z",
  },
  {
    id: "src_4",
    title: "Central Bank of Trinidad & Tobago",
    tier: 1,
    country: "Trinidad & Tobago",
    type: "Regulator",
    health: "healthy",
    lastChecked: "2026-07-20T10:00:00Z",
  },
  {
    id: "src_5",
    title: "Ministry of Public Administration and Artificial Intelligence (MPAAI)",
    tier: 1,
    country: "Trinidad & Tobago",
    type: "Government",
    health: "healthy",
    lastChecked: "2026-07-24T10:00:00Z",
  },
  {
    id: "src_6",
    title: "UNESCO Caribbean — AI Readiness",
    tier: 2,
    country: "Trinidad & Tobago",
    type: "IO",
    health: "healthy",
    lastChecked: "2026-07-24T09:00:00Z",
  },
  {
    id: "src_7",
    title: "Trinidad Express Business",
    tier: 3,
    country: "Trinidad & Tobago",
    type: "Media",
    health: "healthy",
    lastChecked: "2026-07-24T08:00:00Z",
  },
  {
    id: "src_8",
    title: "UWI St. Augustine — AI Innovation Centre",
    tier: 2,
    country: "Trinidad & Tobago",
    type: "Academic",
    health: "healthy",
    lastChecked: "2026-07-23T16:00:00Z",
  },
];

export const SEED_STAKEHOLDERS: Stakeholder[] = [
  {
    id: "sth_1",
    name: "Caribbean Evidence Trust",
    org: "Regional research endowment",
    country: "Barbados",
    recognition: "founding",
    emblem: "violet",
    cause: "Open evidence for public decisions",
    sponsorship:
      "Underwrites the founding principle that Caribbean judgements deserve durable, shareable evidence — not closed briefings.",
  },
  {
    id: "sth_2",
    name: "Port of Spain Civic Forum",
    org: "Independent civic consortium",
    country: "Trinidad & Tobago",
    recognition: "patron",
    emblem: "tide",
    cause: "Transparent infrastructure choices",
    sponsorship:
      "Sponsors the cause of clear procurement and labour narratives so modernization decisions can be argued in daylight.",
  },
  {
    id: "sth_3",
    name: "Guiana Basin Stewardship Circle",
    org: "Cross-sector stewardship body",
    country: "Guyana",
    recognition: "champion",
    emblem: "coral",
    cause: "Stewardship over extractive haste",
    sponsorship:
      "Champions careful sequencing: Power, Systems, and Narratives held together before capital moves.",
  },
  {
    id: "sth_4",
    name: "Eastern Caribbean Signal Lab",
    org: "Island research atelier",
    country: "Saint Lucia",
    recognition: "ally",
    emblem: "foam",
    cause: "Signal over noise across the archipelago",
    sponsorship:
      "Allies with Octivate to keep island voices audible — monitoring what matters before headlines harden into myth.",
  },
];

export const SEED_PACKS: CountryPack[] = [
  {
    id: "pack_gy",
    country: "Guyana",
    sectors: ["Energy", "Oil", "Gas", "EPA", "Procurement"],
    sources: 42,
    entities: 128,
    updatedAt: "2026-07-18T00:00:00Z",
  },
  {
    id: "pack_tt",
    country: "Trinidad & Tobago",
    sectors: ["Energy", "Ports", "Tourism", "Manufacturing"],
    sources: 38,
    entities: 110,
    updatedAt: "2026-07-17T00:00:00Z",
  },
  {
    id: "pack_bb",
    country: "Barbados",
    sectors: ["Tourism", "Finance", "Climate"],
    sources: 24,
    entities: 64,
    updatedAt: "2026-07-16T00:00:00Z",
  },
];

export const SEED_TRENDS: Trend[] = [
  {
    id: "tr_ai_tt",
    title: "T&T AI governance — UNESCO RAM / national framework",
    country: "Trinidad & Tobago",
    sector: "Artificial Intelligence",
    severity: "high",
    summary:
      "MPAAI is advancing a National AI Governance Framework with UNESCO RAM and UNDP AILA; public-service AI and data-protection sequencing are material decision points.",
    publishedAt: "2026-07-24T08:00:00Z",
  },
  {
    id: "tr_1",
    title: "Guyana Energy — FPSO timeline pressure",
    country: "Guyana",
    sector: "Energy",
    severity: "high",
    summary: "Contractor delays and local-content audits may compress midstream windows.",
    publishedAt: "2026-07-20T08:00:00Z",
  },
  {
    id: "tr_2",
    title: "Trinidad LNG — Atlantic train utilization",
    country: "Trinidad & Tobago",
    sector: "Energy",
    severity: "medium",
    summary: "Utilization narratives shifting as gas feedstock debates intensify.",
    publishedAt: "2026-07-19T14:00:00Z",
  },
  {
    id: "tr_jm_re",
    title: "Jamaica renewables — grid / IPP procurement watch",
    country: "Jamaica",
    sector: "Energy",
    severity: "medium",
    summary: "Utility-scale renewable bankability still hinges on interconnection and procurement clarity.",
    publishedAt: "2026-07-19T12:00:00Z",
  },
  {
    id: "tr_3",
    title: "Belize Elections — investor pause",
    country: "Belize",
    sector: "Politics",
    severity: "medium",
    summary: "Pre-election uncertainty elevating short-term political risk premia.",
    publishedAt: "2026-07-19T11:00:00Z",
  },
  {
    id: "tr_4",
    title: "Barbados Tourism — summer bookings firm",
    country: "Barbados",
    sector: "Tourism",
    severity: "info",
    summary: "BTMI signals resilient arrivals; climate adaptation spend remains a watch item.",
    publishedAt: "2026-07-18T16:00:00Z",
  },
  {
    id: "tr_5",
    title: "CARICOM — regional food security pact",
    country: "CARICOM",
    sector: "Policy",
    severity: "low",
    summary: "New coordination language on agri logistics; limited binding instruments yet.",
    publishedAt: "2026-07-18T09:00:00Z",
  },
];

export const DEFAULT_LIMITS: OperatorLimits = {
  tokensPerDay: 250_000,
  concurrentAgents: 3,
  maxUploadsPerProject: 20,
  maxFileSizeMb: 25,
  maxAvatarSizeKb: 2048,
  maxProfileBioChars: 2000,
  documentRetentionDays: 30,
  allowPremiumModels: false,
  requireHumanReview: true,
  allowAutogenerateAccounts: true,
  mockOpenRouter: false,
};

// Baseline usage starts empty; real figures accrue from live agent runs.
export const DEFAULT_USAGE: UsageSnapshot = {
  tokensUsed: 0,
  tokensLimit: DEFAULT_LIMITS.tokensPerDay,
  estimatedCostUsd: 0,
  briefsGenerated: 0,
  sessionsRun: 0,
  period: new Date().toISOString().slice(0, 7),
};

// Cost ledger is populated exclusively by real agent runs.
export const SEED_COSTS: CostEntry[] = [];

export const SEED_MARQUEE: MarqueeItem[] = [
  {
    id: "mq_proc_ports",
    badge: "PROCUREMENT",
    kind: "proc",
    text: "Port authority publishes pre-qualification notice — logistics",
    enabled: true,
    sortOrder: 0,
    createdAt: "2026-07-20T12:00:00Z",
  },
  {
    id: "mq_sys_grid",
    badge: "SYSTEMS",
    kind: "systems",
    text: "Grid maintenance window extended; industrial feeders affected",
    enabled: true,
    sortOrder: 1,
    createdAt: "2026-07-20T12:00:00Z",
  },
  {
    id: "mq_pwr_cabinet",
    badge: "POWER",
    kind: "power",
    text: "Cabinet reshuffle signals shift in energy portfolio priorities",
    enabled: true,
    sortOrder: 2,
    createdAt: "2026-07-20T12:00:00Z",
  },
  {
    id: "mq_narr_radio",
    badge: "NARRATIVE",
    kind: "narrative",
    text: "Local-content sentiment rising across talk radio and WhatsApp",
    enabled: true,
    sortOrder: 3,
    createdAt: "2026-07-20T12:00:00Z",
  },
];

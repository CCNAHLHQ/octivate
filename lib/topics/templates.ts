/**
 * Curated Caribbean decision-intelligence topic templates.
 * Used as one-click project starters that seed a real strategic question
 * and (optionally) kick the agent pipeline immediately.
 */

export type TopicTemplate = {
  id: string;
  name: string;
  country: string;
  sector: string;
  question: string;
  summary: string;
  heat: "hot" | "rising" | "watch";
  tags: string[];
  sources: { title: string; url?: string; type: string }[];
  suggestedDepth: "rapid" | "standard" | "deep_dive";
};

export const TOPIC_TEMPLATES: TopicTemplate[] = [
  {
    id: "topic_tt_ai_governance",
    name: "AI governance in Trinidad & Tobago",
    country: "Trinidad & Tobago",
    sector: "Artificial Intelligence",
    heat: "hot",
    tags: ["AI", "UNESCO RAM", "MPAAI", "public service", "governance"],
    suggestedDepth: "standard",
    summary:
      "National AI Governance Framework, UNESCO RAM readiness, and UNDP AILA assessments are reshaping how T&T deploys AI in the public service.",
    question:
      "Given Trinidad and Tobago's National AI Governance Framework work with UNESCO RAM and UNDP AILA, what are the principal political, regulatory, and institutional risks and opportunities for deploying AI in public services through 2027 — and which decisions should operators lock now versus defer?",
    sources: [
      {
        title: "Ministry of Public Administration and Artificial Intelligence — national AI initiatives",
        url: "https://mpaai.gov.tt",
        type: "Government",
      },
      {
        title: "UNESCO — T&T AI readiness / RAM validation",
        url: "https://www.unesco.org/en/articles/unesco-supports-trinidad-and-tobago-advancing-ai-readiness",
        type: "IO",
      },
      {
        title: "UWI St. Augustine — AI Readiness Assessment Methodology workshop",
        url: "https://sta.uwi.edu",
        type: "Academic",
      },
      {
        title: "Trinidad Express — AI-powered public service vision",
        url: "https://trinidadexpress.com",
        type: "Media",
      },
    ],
  },
  {
    id: "topic_guyana_local_content",
    name: "Guyana local-content & energy entry",
    country: "Guyana",
    sector: "Energy",
    heat: "hot",
    tags: ["LNG", "local content", "EPA", "FPSO", "investment"],
    suggestedDepth: "deep_dive",
    summary:
      "FPSO timelines, Local Content Act enforcement, and EPA permitting continue to dominate midstream investment windows.",
    question:
      "What are the political and regulatory risks for a midstream LNG investment in Guyana through 2028, with particular attention to local-content compliance, EPA pathways, and contractor capacity?",
    sources: [
      { title: "Guyana Official Gazette", type: "Government" },
      { title: "EPA Guyana guidelines", type: "Regulator" },
      { title: "Stabroek News — energy desk", type: "Media" },
    ],
  },
  {
    id: "topic_tt_ports",
    name: "T&T port modernization",
    country: "Trinidad & Tobago",
    sector: "Infrastructure",
    heat: "rising",
    tags: ["ports", "procurement", "logistics", "unions"],
    suggestedDepth: "standard",
    summary:
      "Port Authority modernization and regional logistics-hub ambitions face procurement opacity and labour leverage.",
    question:
      "Should a private terminal operator pursue Port of Spain modernization participation in the next 24 months — what stakeholder, procurement, and labour risks are material, and what evidence would change the call?",
    sources: [
      { title: "Port Authority of Trinidad and Tobago", type: "Agency" },
      { title: "Central Bank of Trinidad & Tobago", type: "Regulator" },
    ],
  },
  {
    id: "topic_barbados_tourism_climate",
    name: "Barbados tourism & climate resilience",
    country: "Barbados",
    sector: "Tourism",
    heat: "rising",
    tags: ["tourism", "climate", "BTMI", "adaptation"],
    suggestedDepth: "standard",
    summary:
      "Arrivals remain resilient while climate adaptation spend and insurance costs reshape hospitality CapEx.",
    question:
      "How should a hotel group weigh Barbados tourism resilience against climate-adaptation CapEx and insurance risk through 2028?",
    sources: [
      { title: "Barbados Tourism Marketing Inc. outlook", type: "Agency" },
      { title: "CARICOM climate coordination notes", type: "Regional" },
    ],
  },
  {
    id: "topic_jamaica_renewables",
    name: "Jamaica renewable power procurement",
    country: "Jamaica",
    sector: "Energy",
    heat: "hot",
    tags: ["renewables", "procurement", "grid", "IPP"],
    suggestedDepth: "standard",
    summary:
      "Grid constraints and IPP procurement cycles are the binding constraints on renewable project bankability.",
    question:
      "What power-system, procurement, and political risks should an independent power producer underwrite before committing CapEx to a utility-scale solar or wind project in Jamaica?",
    sources: [
      { title: "Jamaica Public Service / OUR filings", type: "Regulator" },
      { title: "Ministry of Science, Energy and Technology", type: "Government" },
    ],
  },
  {
    id: "topic_caricom_food_security",
    name: "CARICOM food security logistics",
    country: "CARICOM",
    sector: "Policy",
    heat: "watch",
    tags: ["food security", "agri logistics", "trade", "CARICOM"],
    suggestedDepth: "rapid",
    summary:
      "Regional food-security coordination language is advancing faster than binding logistics instruments.",
    question:
      "Where can a regional agri-logistics investor realistically deploy capital under current CARICOM food-security coordination — and what political or systems gaps still block bankable routes?",
    sources: [
      { title: "CARICOM Secretariat agriculture communications", type: "Regional" },
      { title: "FAO Caribbean food security briefs", type: "IO" },
    ],
  },
  {
    id: "topic_tt_data_protection_ai",
    name: "T&T data protection vs AI deployment",
    country: "Trinidad & Tobago",
    sector: "Regulation",
    heat: "rising",
    tags: ["Data Protection Act", "privacy", "AI", "compliance"],
    suggestedDepth: "standard",
    summary:
      "Privacy-by-design and Data Protection Act modernisation are becoming gate conditions for AI in public platforms.",
    question:
      "How should a vendor selling AI tools into Trinidad and Tobago's public service sequence product, data-protection, and procurement compliance so that privacy reforms do not block deployment?",
    sources: [
      { title: "Data Protection Act / Office of the Information Commissioner", type: "Regulator" },
      { title: "MPAAI digital transformation communications", type: "Government" },
    ],
  },
  {
    id: "topic_suriname_oil_governance",
    name: "Suriname offshore oil governance",
    country: "Suriname",
    sector: "Energy",
    heat: "watch",
    tags: ["offshore", "governance", "fiscal", "NOC"],
    suggestedDepth: "deep_dive",
    summary:
      "Offshore discoveries raise fiscal-regime and national-oil-company capacity questions for new entrants.",
    question:
      "What governance, fiscal, and institutional risks should an international oil company underwrite before a Suriname offshore development FID?",
    sources: [
      { title: "Staatsolie / Ministry of Natural Resources communications", type: "Government" },
      { title: "Regional energy press (Suriname desk)", type: "Media" },
    ],
  },
];

export function findTopicTemplate(id: string) {
  return TOPIC_TEMPLATES.find((t) => t.id === id) ?? null;
}

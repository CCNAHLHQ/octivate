import fs from "fs";

const path = "data/local/projects.json";
if (!fs.existsSync(path)) {
  console.log("no local projects");
  process.exit(0);
}

const items = JSON.parse(fs.readFileSync(path, "utf8"));
const add = [
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
    id: "proj_jamaica_renewables",
    name: "Jamaica renewable power procurement",
    country: "Jamaica",
    sector: "Energy",
    question:
      "What power-system, procurement, and political risks should an independent power producer underwrite before committing CapEx to a utility-scale solar or wind project in Jamaica?",
    documents: [
      {
        id: "doc_jm_1",
        name: "Jamaica-IPP-procurement-notes.md",
        type: "Markdown",
        uploadedAt: "2026-07-18T10:00:00Z",
      },
    ],
    createdAt: "2026-07-18T10:05:00Z",
    updatedAt: "2026-07-18T10:05:00Z",
    status: "active",
  },
];

let changed = false;
for (const p of add) {
  if (!items.find((x) => x.id === p.id)) {
    items.unshift(p);
    changed = true;
  }
}
for (const it of items) {
  if (it.id === "proj_tt_ports" && !it.question) {
    it.question =
      "Should a private terminal operator pursue Port of Spain modernization participation in the next 24 months — what stakeholder, procurement, and labour risks are material?";
    changed = true;
  }
  if (it.id === "proj_barbados_tourism" && !it.question) {
    it.question =
      "How should a hotel group weigh Barbados tourism resilience against climate-adaptation CapEx and insurance risk through 2028?";
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(path, JSON.stringify(items, null, 2));
  console.log("updated projects", items.length);
} else {
  console.log("projects already current", items.length);
}

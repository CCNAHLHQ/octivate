/**
 * One-shot: import data/local/source-registry.csv → data/local/sources.json
 * Usage: node scripts/import-source-registry.mjs [optional-source-csv-path]
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const defaultCsv = path.join(root, "data", "local", "source-registry.csv");
const outPath = path.join(root, "data", "local", "sources.json");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let i = 0;
  let quoted = false;
  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    if (row.some((c) => String(c).trim())) rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      cell += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      pushCell();
      i += 1;
      continue;
    }
    if (c === "\r") {
      i += 1;
      continue;
    }
    if (c === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    cell += c;
    i += 1;
  }
  if (cell.length || row.length) pushRow();
  return rows;
}

function splitList(value, sep = /,/) {
  if (!value?.trim()) return [];
  return value
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
}

function slugId(name, url) {
  const base = (url || name || "source")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return `src_${base || "unknown"}`;
}

function resolveSourceId(row, name, url) {
  const raw = String(row.source_id || "")
    .trim()
    .toLowerCase();
  if (raw) {
    const cleaned = raw
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 72);
    if (cleaned) return cleaned.startsWith("src_") ? cleaned : `src_${cleaned}`;
  }
  return slugId(name, url);
}

function firstText(...values) {
  for (const v of values) {
    const t = String(v || "").trim();
    if (t) return t;
  }
  return undefined;
}

function deriveTier(watch, total, retrieval) {
  if (watch === "Core" && total >= 18) return 1;
  if (watch === "Core") return 2;
  if (retrieval === "High") return 3;
  return 4;
}

function rowToSource(row, importedAt) {
  const countries = splitList(row.country || "", /;/);
  const watch = row.watch_priority || "Secondary";
  const retrieval = row.retrieval_priority || "Medium";
  const total = Number.parseInt(row.total_source_score || "0", 10) || 0;
  const title = row.source_name || "Untitled source";
  const url = row.source_url || undefined;
  const userRelevance = splitList(row.user_relevance).length
    ? splitList(row.user_relevance)
    : splitList(row.client_types_that_would_care);
  return {
    id: resolveSourceId(row, title, url || ""),
    title,
    tier: deriveTier(watch, total, retrieval),
    country: countries[0] || row.country || "Regional",
    countries: countries.length ? countries : [row.country || "Regional"].filter(Boolean),
    type: row.source_type || row.source_type_preset || "Unknown",
    typePreset: row.source_type_preset || undefined,
    url,
    primaryRetrievalUrl: row.primary_retrieval_url || undefined,
    dataPublicationsUrl: row.data_publications_url || undefined,
    subregion: row.subregion || undefined,
    institutionOwner: row.institution_owner || undefined,
    psnLayers: splitList(row.psn_layers),
    sectorTags: splitList(row.sector_tags),
    userRelevance,
    bestUsedFor: firstText(row.best_used_for, row.best_intelligence_uses),
    limitationsBiasNote: firstText(row.limitations_bias_note, row.known_limitations),
    evidenceRoles: splitList(row.evidence_roles),
    triangulationRequirement: row.triangulation_requirement || undefined,
    reliabilityScore: Number.parseInt(row.reliability_score || "0", 10) || 0,
    timelinessScore: Number.parseInt(row.timeliness_score || "0", 10) || 0,
    signalValueScore: Number.parseInt(row.signal_value_score || "0", 10) || 0,
    decisionUsefulnessScore: Number.parseInt(row.decision_usefulness_score || "0", 10) || 0,
    totalSourceScore: total,
    watchPriority: watch,
    retrievalPriority: retrieval,
    briefUse: row.brief_use || undefined,
    humanReviewRequired: String(row.human_review_required || "").toLowerCase() === "true",
    notes: firstText(row.notes, row.registry_notes, row.passport_notes),
    sourceSummary: firstText(row.source_summary),
    whyThisSourceMatters: firstText(row.why_this_source_matters),
    exampleQuestions: firstText(row.example_questions),
    analystConfidence: firstText(row.analyst_confidence),
    health: "healthy",
    lastChecked: importedAt,
    registryImportedAt: importedAt,
  };
}

const srcCsv = process.argv[2]
  ? path.resolve(process.argv[2])
  : defaultCsv;

const text = await fs.readFile(srcCsv, "utf8");
if (srcCsv !== defaultCsv) {
  await fs.mkdir(path.dirname(defaultCsv), { recursive: true });
  await fs.copyFile(srcCsv, defaultCsv);
}

const table = parseCsv(text.replace(/^\uFEFF/, ""));
const headers = table[0].map((h) => h.trim());
const importedAt = new Date().toISOString();
const sources = table
  .slice(1)
  .map((cells) => {
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    return row;
  })
  .filter((r) => r.source_name)
  .map((r) => rowToSource(r, importedAt))
  .sort((a, b) => (b.totalSourceScore || 0) - (a.totalSourceScore || 0));

await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, JSON.stringify(sources, null, 2), "utf8");
console.log(
  JSON.stringify(
    {
      ok: true,
      from: srcCsv,
      registry: defaultCsv,
      out: outPath,
      count: sources.length,
      tier1: sources.filter((s) => s.tier === 1).length,
      core: sources.filter((s) => s.watchPriority === "Core").length,
    },
    null,
    2
  )
);

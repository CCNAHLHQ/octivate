import type { Project, Source, SourceRecord, Trend } from "@/lib/types";
import { formatSourcePromptLine, sourceToRecord } from "@/lib/sources/registry-map";

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim();
}

function countryTokens(source: Source): string[] {
  if (source.countries?.length) return source.countries;
  return source.country ? [source.country] : [];
}

function isRegional(source: Source): boolean {
  return countryTokens(source).some((c) => {
    const n = norm(c);
    return n === "regional" || n.includes("caricom") || n.includes("multi country");
  });
}

function countryExact(source: Source, projectCountry: string): boolean {
  const pc = norm(projectCountry);
  return countryTokens(source).some((c) => {
    const n = norm(c);
    return n === pc || n.includes(pc) || pc.includes(n);
  });
}

function sectorOverlap(source: Source, projectSector: string): boolean {
  const sector = norm(projectSector);
  if (!sector) return true;
  const tags = source.sectorTags || [];
  if (!tags.length) return source.watchPriority === "Core";
  const stem = sector.slice(0, 6);
  return tags.some((t) => {
    const tn = norm(t);
    return tn.includes(sector) || sector.includes(tn) || (stem.length >= 4 && tn.includes(stem));
  });
}

function retrievalRank(p?: string): number {
  return p === "High" ? 2 : p === "Medium" ? 1 : 0;
}

function watchRank(p?: string): number {
  return p === "Core" ? 2 : 1;
}

export function selectCatalogSources(
  sources: Source[],
  project: Project,
  limit = 8,
  opts?: { preferLocalIds?: Set<string> }
): Source[] {
  const eligible = sources.filter((s) => {
    const geoOk = countryExact(s, project.country) || isRegional(s);
    if (!geoOk) return false;
    if (s.watchPriority === "Core") return true;
    return sectorOverlap(s, project.sector);
  });

  const ranked = eligible
    .map((s) => {
      const exact = countryExact(s, project.country) ? 2 : isRegional(s) ? 1 : 0;
      const sector = sectorOverlap(s, project.sector) ? 1 : 0;
      const localBoost = opts?.preferLocalIds?.has(s.id) ? 50_000 : 0;
      const relevanceBoost = (s.userRelevance?.length || 0) * 5;
      return {
        s,
        score:
          exact * 1_000_000 +
          retrievalRank(s.retrievalPriority) * 100_000 +
          localBoost +
          (s.totalSourceScore ?? 0) * 1_000 +
          watchRank(s.watchPriority) * 100 +
          sector * 10 +
          relevanceBoost +
          (5 - (s.tier || 4)),
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);

  return ranked.slice(0, limit);
}

function trendCountryOk(trendCountry: string, projectCountry: string): boolean {
  const tc = norm(trendCountry);
  const pc = norm(projectCountry);
  if (!tc || !pc) return false;
  return tc === pc || tc.includes(pc) || pc.includes(tc);
}

function trendIsRegional(trendCountry: string): boolean {
  const n = norm(trendCountry);
  return n === "caricom" || n === "regional" || n.includes("multi country");
}

function trendQuestionRelevance(trend: Trend, project: Project, question?: string): number {
  const hay = `${trend.title} ${trend.summary} ${trend.sector}`.toLowerCase();
  const tokens = [
    ...norm(project.country).split(/\s+/),
    ...norm(project.sector).split(/\s+/),
    ...norm(project.name || "").split(/\s+/),
    ...norm(question || "")
      .split(/\s+/)
      .filter((w) => w.length >= 4)
      .slice(0, 12),
  ].filter(Boolean);
  let hits = 0;
  for (const t of tokens) {
    if (t.length >= 3 && hay.includes(t)) hits += 1;
  }
  return hits;
}

/**
 * Geography-first trend selection. Sector overlap ranks inside eligible geo —
 * it must not admit Trinidad LNG into a Guyana Energy brief.
 */
export function selectTrendRecords(
  trends: Trend[],
  project: Project,
  limit = 4,
  opts?: { question?: string }
): SourceRecord[] {
  const question = opts?.question || project.question || "";
  const eligible = trends.filter((t) => {
    if (trendCountryOk(t.country, project.country)) return true;
    if (trendIsRegional(t.country)) {
      // Regional/CARICOM only when explicitly relevant to this theatre/question.
      return trendQuestionRelevance(t, project, question) >= 2;
    }
    return false;
  });

  const ranked = eligible
    .map((t) => {
      const exact = trendCountryOk(t.country, project.country) ? 2 : 1;
      const sector = t.sector.toLowerCase().includes(project.sector.toLowerCase().slice(0, 6))
        ? 1
        : 0;
      const q = trendQuestionRelevance(t, project, question);
      return { t, score: exact * 1_000 + sector * 100 + q * 10 };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t)
    .slice(0, limit);

  return ranked.map((t) => ({
    source_id: t.id,
    title: t.title,
    evidence_class: "public_discourse_signal" as const,
    reliability: t.severity === "high" ? "moderate" : "low",
    decision_relevance: t.summary,
    country: t.country,
    retrieved_at: t.publishedAt,
    review_flags: ["open_source_signal"],
  }));
}

export function buildEvidenceSourceContext(
  catalog: Source[],
  records: SourceRecord[]
): string {
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const lines = records.map((r) => {
    const src = byId.get(r.source_id);
    if (src) return formatSourcePromptLine(src, r);
    return `- ${r.source_id}: ${r.title} | reliability=${r.reliability} | evidence_class=${r.evidence_class}`;
  });
  return `Available sources (registry-ranked; use retrieval urls as anchors — do not invent citations):\n${lines.join("\n")}`;
}

export function catalogToRecords(selected: Source[], project: Project): SourceRecord[] {
  return selected.map((s) => sourceToRecord(s, project));
}

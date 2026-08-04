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

export function selectCatalogSources(sources: Source[], project: Project, limit = 8): Source[] {
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
      return {
        s,
        score:
          exact * 1_000_000 +
          retrievalRank(s.retrievalPriority) * 100_000 +
          (s.totalSourceScore ?? 0) * 1_000 +
          watchRank(s.watchPriority) * 100 +
          sector * 10 +
          (5 - (s.tier || 4)),
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);

  return ranked.slice(0, limit);
}

export function selectTrendRecords(
  trends: Trend[],
  project: Project,
  limit = 4
): SourceRecord[] {
  return trends
    .filter(
      (t) =>
        t.country === project.country ||
        t.sector.toLowerCase().includes(project.sector.toLowerCase().slice(0, 6)) ||
        t.country === "CARICOM"
    )
    .slice(0, limit)
    .map((t) => ({
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

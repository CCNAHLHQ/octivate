import type { Source } from "@/lib/types";
import type { DocumentLabel } from "@/lib/evidence/types";

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim();
}

function countHits(haystack: string, needle: string): number {
  const h = norm(haystack);
  const n = norm(needle);
  if (!n || n.length < 2) return 0;
  let count = 0;
  let idx = 0;
  while (idx <= h.length) {
    const at = h.indexOf(n, idx);
    if (at < 0) break;
    count += 1;
    idx = at + n.length;
  }
  return count;
}

/** Rule-first local labeling from curated source keyword indicators. */
export function labelTextFromSource(
  text: string,
  source: Source,
  question = "",
  projectSector = ""
): DocumentLabel[] {
  const corpus = `${text}\n${question}\n${projectSector}`;
  const labels: DocumentLabel[] = [];

  for (const layer of source.psnLayers || []) {
    const hits = countHits(corpus, layer) || (norm(layer) ? 1 : 0);
    // Always attach curator PSN layers as soft labels; boost when text hits.
    labels.push({
      kind: "psn",
      value: layer,
      weight: hits > 1 ? Math.min(1, 0.55 + hits * 0.1) : 0.45,
      method: "rule",
      hitCount: countHits(text, layer),
    });
  }

  for (const sector of source.sectorTags || []) {
    const inText = countHits(text, sector);
    const inProject = projectSector && norm(sector).includes(norm(projectSector).slice(0, 6));
    if (inText || inProject) {
      labels.push({
        kind: "sector",
        value: sector,
        weight: Math.min(1, 0.5 + inText * 0.12 + (inProject ? 0.2 : 0)),
        method: "rule",
        hitCount: inText,
      });
    }
  }

  for (const rel of source.userRelevance || []) {
    const hits = countHits(text, rel) + countHits(question, rel);
    labels.push({
      kind: "relevance",
      value: rel,
      weight: Math.min(1, 0.35 + hits * 0.12),
      method: "rule",
      hitCount: hits,
    });
  }

  // Expand retrieval from project question tokens present in text
  const qTokens = norm(question)
    .split(/\s+/)
    .filter((t) => t.length >= 5)
    .slice(0, 8);
  for (const tok of qTokens) {
    const hits = countHits(text, tok);
    if (hits > 0) {
      labels.push({
        kind: "relevance",
        value: tok,
        weight: Math.min(1, 0.4 + hits * 0.1),
        method: "rule",
        hitCount: hits,
      });
    }
  }

  return labels;
}

export function labelCoverageScore(labels: DocumentLabel[]): number {
  if (!labels.length) return 0;
  const avg = labels.reduce((a, l) => a + l.weight, 0) / labels.length;
  const psn = labels.some((l) => l.kind === "psn" && (l.hitCount || 0) > 0) ? 0.15 : 0;
  const sector = labels.some((l) => l.kind === "sector") ? 0.15 : 0;
  return Math.min(1, avg * 0.7 + psn + sector);
}

import type { Brief, MaterialFinding } from "@/lib/types";

/** Coerce LLM/agent gap payloads (string | object) into display strings. */
export function coerceTextList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const t = item.trim();
      if (t) out.push(t);
      continue;
    }
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      const text = [row.description, row.finding, row.label, row.gap, row.text, row.message]
        .find((v) => typeof v === "string" && String(v).trim());
      if (typeof text === "string" && text.trim()) {
        out.push(text.trim());
        continue;
      }
    }
  }
  return [...new Set(out)];
}

function coerceFindings(raw: unknown): MaterialFinding[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is MaterialFinding => {
    return Boolean(row && typeof row === "object" && "finding_id" in (row as object));
  });
}

/**
 * Ensure a brief is safe to render and link: string lists only,
 * stable optional fields. Does not mutate the input.
 */
export function normalizeBrief(brief: Brief): Brief {
  const gaps = coerceTextList(brief.gaps);
  const evidenceGaps = coerceTextList(brief.evidenceGaps ?? brief.gaps);
  const power = coerceTextList(brief.power);
  const systems = coerceTextList(brief.systems);
  const narratives = coerceTextList(brief.narratives);
  const recommendations = coerceTextList(brief.recommendations);
  const tradeoffs = brief.tradeoffs ? coerceTextList(brief.tradeoffs) : undefined;
  const reviewFlags = brief.reviewFlags ? coerceTextList(brief.reviewFlags) : undefined;

  const structured = brief.structuredFindings
    ? {
        power: coerceFindings(brief.structuredFindings.power),
        systems: coerceFindings(brief.structuredFindings.systems),
        narratives: coerceFindings(brief.structuredFindings.narratives),
      }
    : undefined;

  // Doctrine briefs often keep rich findings only under structuredFindings —
  // backfill flat PSN lists so exports and UI always have readable lens text.
  const fromStructured = (rows: MaterialFinding[] | undefined) =>
    (rows || [])
      .map((f) => {
        const row = f as MaterialFinding & Record<string, unknown>;
        return String(row.finding || row.narrative || row.decision_effect || "").trim();
      })
      .filter(Boolean);

  const powerResolved =
    power.length > 0 ? power : fromStructured(structured?.power);
  const systemsResolved =
    systems.length > 0 ? systems : fromStructured(structured?.systems);
  const narrativesResolved =
    narratives.length > 0 ? narratives : fromStructured(structured?.narratives);

  return {
    ...brief,
    gaps: gaps.length ? gaps : evidenceGaps.length ? evidenceGaps : [],
    evidenceGaps: evidenceGaps.length ? evidenceGaps : gaps.length ? gaps : undefined,
    power: powerResolved,
    systems: systemsResolved,
    narratives: narrativesResolved,
    recommendations,
    tradeoffs,
    reviewFlags,
    structuredFindings: structured,
  };
}

export function normalizeBriefs(briefs: Brief[]): Brief[] {
  return briefs.map(normalizeBrief);
}

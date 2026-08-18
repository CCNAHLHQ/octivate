/**
 * Deterministic temporal / lifecycle current-state resolver.
 * “RFP document exists” ≠ currently open; expired deadlines cannot be ACT NOW.
 */

import type { EvidenceClaim, ProjectStateFact } from "@/lib/types";

export type LifecycleState =
  | "open"
  | "active"
  | "closed"
  | "expired"
  | "awarded"
  | "superseded"
  | "unknown"
  | "planned";

const DATE_PATTERN =
  /\b(?:(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})|(\d{4})-(\d{2})-(\d{2}))\b/gi;

const MONTH: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function dateRegex() {
  // Fresh instance every call — shared /g regex + nested exec causes infinite loops.
  return new RegExp(DATE_PATTERN.source, DATE_PATTERN.flags);
}

function matchToIso(m: RegExpExecArray): string | null {
  if (m[4] && m[5] && m[6]) {
    return `${m[4]}-${m[5]}-${m[6]}`;
  }
  const day = Number(m[1]);
  const mon = MONTH[String(m[2] || "").toLowerCase()];
  const year = Number(m[3]);
  if (!Number.isFinite(day) || mon == null || !Number.isFinite(year)) return null;
  return new Date(Date.UTC(year, mon, day)).toISOString().slice(0, 10);
}

export function parseLooseDate(raw: string): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  // Prefer explicit calendar forms over Date.parse (avoids TZ day-shift on date-only strings).
  const re = dateRegex();
  const m = re.exec(s);
  if (m && m.index === 0) {
    const iso = matchToIso(m);
    if (iso) return iso;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const iso = Date.parse(s);
  if (Number.isFinite(iso)) return new Date(iso).toISOString().slice(0, 10);
  const any = dateRegex().exec(s);
  return any ? matchToIso(any) : null;
}

function extractDates(text: string): string[] {
  const out: string[] = [];
  const re = dateRegex();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const parsed = matchToIso(m);
    if (parsed && !out.includes(parsed)) out.push(parsed);
  }
  return out;
}

function inferComponent(statement: string): string {
  const t = statement.toLowerCase();
  if (/ngl|o\s*&\s*m|om\b|operations?\s+and\s+maintenance/.test(t)) return "ngl_om_rfp";
  if (/\beoi\b|expression of interest/.test(t)) return "eoi";
  if (/rfp|request for proposal/.test(t)) return "rfp";
  if (/commission|cod\b|commercial operation/.test(t)) return "commissioning";
  if (/award|selected|preferred bidder/.test(t)) return "award";
  return "opportunity";
}

function inferIssuedOrDeadline(statement: string): {
  issuedAt?: string;
  deadlineAt?: string;
  observedAt?: string;
} {
  const t = statement.toLowerCase();
  const dates = extractDates(statement);
  const issuedAt = /issued|published|released|launched/.test(t) ? dates[0] : undefined;
  const deadlineAt = /deadline|closes?|closing|due|submit by|submission/.test(t)
    ? dates[dates.length - 1] || dates[0]
    : /eoi|rfp/.test(t) && dates.length
      ? dates[dates.length - 1]
      : undefined;
  return {
    issuedAt,
    deadlineAt,
    observedAt: dates[0],
  };
}

function classifyFromClaim(claim: EvidenceClaim, asOf: string): LifecycleState {
  if (claim.lifecycleState) return claim.lifecycleState as LifecycleState;
  const t = `${claim.statement} ${claim.predicate || ""} ${claim.objectValue || ""}`.toLowerCase();
  if (/award|selected|preferred bidder|contract signed/.test(t)) return "awarded";
  if (/supersed|replaced by|no longer open|cancelled|withdrawn/.test(t)) return "superseded";
  if (/closed|expired|lapsed|passed/.test(t)) return "expired";
  if (/planned|forthcoming|upcoming|will issue/.test(t)) return "planned";

  const { deadlineAt, issuedAt } = inferIssuedOrDeadline(claim.statement);
  const deadline = claim.deadlineAt || deadlineAt;
  const issued = claim.issuedAt || issuedAt;

  // Document existence alone never proves open/active.
  if (deadline && deadline < asOf) return "expired";
  if (deadline && deadline >= asOf && /open|active|currently|invite/.test(t)) return "open";
  if (issued && !deadline && /rfp|eoi|invitation/.test(t)) return "unknown";
  if (/open|active|currently accepting/.test(t) && (!deadline || deadline >= asOf)) {
    return deadline ? "open" : "unknown";
  }
  return "unknown";
}

function claimConfidence(claim: EvidenceClaim): number {
  const map: Record<string, number> = {
    high: 0.9,
    moderate: 0.7,
    low: 0.45,
    plausible_unverified: 0.35,
    insufficient_evidence: 0.2,
  };
  return map[claim.confidence || ""] ?? 0.5;
}

/** Build opportunity state facts from claims evaluated at asOf (YYYY-MM-DD). */
export function resolveCurrentState(
  claims: EvidenceClaim[],
  asOfInput?: string | Date
): ProjectStateFact[] {
  const asOfDate =
    asOfInput instanceof Date
      ? asOfInput
      : asOfInput
        ? new Date(asOfInput)
        : new Date();
  const asOf = asOfDate.toISOString().slice(0, 10);

  const byComponent = new Map<string, ProjectStateFact[]>();

  for (const claim of claims) {
    const component = claim.component || inferComponent(claim.statement);
    const dates = inferIssuedOrDeadline(claim.statement);
    const state = classifyFromClaim(claim, asOf);
    const fact: ProjectStateFact = {
      fact_id: `state_${claim.claim_id}`,
      subject: claim.subject || component,
      component,
      state,
      issuedAt: claim.issuedAt || dates.issuedAt,
      deadlineAt: claim.deadlineAt || dates.deadlineAt,
      observedAt: claim.eventDate || claim.observedAt || dates.observedAt || asOf,
      validFrom: claim.eventDate || claim.observedAt || dates.observedAt || asOf,
      sourceIds: [...(claim.source_ids || [])],
      evidenceIds: [...(claim.evidence_ids || [])],
      claimIds: [claim.claim_id],
      supersedesFactIds: [],
      confidence: claimConfidence(claim),
      statusVerified: state !== "unknown" && state !== "planned",
      asOf,
      statement: claim.statement,
    };

    // Hard rule: past deadline without reopening → expired/closed, never open/active.
    if (fact.deadlineAt && fact.deadlineAt < asOf && (state === "open" || state === "active")) {
      fact.state = "expired";
      fact.statusVerified = true;
    }
    if (!fact.deadlineAt && !fact.issuedAt && /rfp|eoi/.test(component) && state === "active") {
      fact.state = "unknown";
      fact.statusVerified = false;
    }

    const list = byComponent.get(component) || [];
    list.push(fact);
    byComponent.set(component, list);
  }

  const resolved: ProjectStateFact[] = [];
  for (const [, facts] of byComponent) {
    facts.sort((a, b) => String(a.observedAt).localeCompare(String(b.observedAt)));
    let current: ProjectStateFact | null = null;
    for (const f of facts) {
      if (
        current &&
        (f.state === "awarded" ||
          f.state === "superseded" ||
          f.state === "closed" ||
          f.state === "expired" ||
          (current.state === "open" && f.state === "awarded"))
      ) {
        f.supersedesFactIds = [current.fact_id];
      }
      current = f;
      resolved.push(f);
    }
  }

  return resolved;
}

/** Latest fact per component after supersession. */
export function latestStateByComponent(
  facts: ProjectStateFact[]
): Map<string, ProjectStateFact> {
  const map = new Map<string, ProjectStateFact>();
  for (const f of facts) {
    const prev = map.get(f.component);
    if (!prev || String(f.observedAt) >= String(prev.observedAt)) {
      map.set(f.component, f);
    }
  }
  return map;
}

export function formatCurrentStateForAgent(facts: ProjectStateFact[]): string {
  if (!facts.length) {
    return "Current-state facts: (none resolved — treat opportunity status as UNKNOWN until verified).";
  }
  const latest = latestStateByComponent(facts);
  const lines = [...latest.values()].map((f) => {
    const bits = [
      `state=${f.state}`,
      f.deadlineAt ? `deadline=${f.deadlineAt}` : null,
      f.issuedAt ? `issued=${f.issuedAt}` : null,
      `verified=${f.statusVerified}`,
      `asOf=${f.asOf}`,
    ].filter(Boolean);
    return `- [${f.component}] ${bits.join(" · ")} — ${(f.statement || "").slice(0, 180)}`;
  });
  return [
    "Canonical current-state (deterministic; do not contradict without newer evidence):",
    "Never recommend ACT NOW / prepare for a deadline that is already past asOf.",
    "RFP/EOI document existence alone does not establish open/active status.",
    ...lines,
  ].join("\n");
}

export function hasUnknownDecisionCriticalState(facts: ProjectStateFact[]): boolean {
  const latest = latestStateByComponent(facts);
  for (const f of latest.values()) {
    if (
      (f.component.includes("rfp") ||
        f.component.includes("eoi") ||
        f.component.includes("ngl")) &&
      (f.state === "unknown" || !f.statusVerified)
    ) {
      return true;
    }
  }
  return false;
}

export function hasExpiredOpportunityPresentedAsOpen(
  facts: ProjectStateFact[],
  clientText: string
): boolean {
  const t = clientText.toLowerCase();
  // Corrective language about expired deadlines should not trip the gate.
  if (
    /do not (?:pursue|treat)|not (?:open|active)|already (?:past|expired)|expired eoi|deadline(?:s)? (?:that )?(?:is |are )?already|verify .+ before/i.test(
      t
    ) &&
    !/\bact now\b|pursue now|currently open|active rfp/.test(t)
  ) {
    return false;
  }
  const latest = latestStateByComponent(facts);
  for (const f of latest.values()) {
    if (f.state !== "expired" && f.state !== "closed") continue;
    if (/\bact now\b|pursue now|currently open|active rfp/.test(t)) {
      if (f.deadlineAt && t.includes(f.deadlineAt.slice(0, 4))) return true;
      if (/eoi|rfp|ngl/.test(t)) return true;
    }
  }
  return false;
}

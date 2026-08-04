/**
 * Local citation engine — search capture / evidence text for passages
 * that support brief findings (no remote search).
 */

import type { BriefCitedSource } from "@/lib/types";
import type { EvidenceDocument } from "@/lib/evidence/types";

export type CitationPassage = {
  text: string;
  start: number;
  end: number;
  score: number;
  query: string;
};

const STOP = new Set(
  "a an the and or but of to in on for with from by as at is are was were be been being this that these those it its their our your they we you i he she not no nor so if then than into over under about between through during before after above below up down out off again further once here there when where why how all each few more most other some such only own same too very can will just should now".split(
    /\s+/
  )
);

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s%-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
    .slice(0, 14);
}

function scoreWindow(window: string, tokens: string[]): number {
  if (!tokens.length) return 0;
  const lower = window.toLowerCase();
  let hits = 0;
  for (const t of tokens) {
    if (lower.includes(t)) hits += 1;
  }
  return hits / tokens.length;
}

/** Find best local passages in `haystack` matching `query`. */
export function findSupportingPassages(
  haystack: string,
  query: string,
  opts?: { max?: number; windowChars?: number }
): CitationPassage[] {
  const text = String(haystack || "").replace(/\s+/g, " ").trim();
  const q = String(query || "").trim();
  if (!text || !q) return [];

  const tokens = tokenize(q);
  if (!tokens.length) return [];

  const windowChars = opts?.windowChars ?? 220;
  const max = opts?.max ?? 3;
  const step = Math.max(40, Math.floor(windowChars / 3));
  const scored: CitationPassage[] = [];

  for (let i = 0; i < text.length; i += step) {
    const start = i;
    const end = Math.min(text.length, i + windowChars);
    const slice = text.slice(start, end);
    const score = scoreWindow(slice, tokens);
    if (score < 0.28) continue;
    scored.push({ text: slice.trim(), start, end, score, query: q });
    if (end >= text.length) break;
  }

  scored.sort((a, b) => b.score - a.score);

  const out: CitationPassage[] = [];
  for (const p of scored) {
    if (out.some((o) => Math.abs(o.start - p.start) < windowChars * 0.55)) continue;
    out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

/** Enrich cited sources with local supporting passages from evidence docs. */
export function attachCitationPassages(
  sources: BriefCitedSource[],
  evidence: EvidenceDocument[],
  queries: string[]
): BriefCitedSource[] {
  const bySource = new Map(evidence.map((e) => [e.sourceId || "", e]));
  const qs = queries.map((q) => String(q || "").trim()).filter(Boolean).slice(0, 12);

  return sources.map((s) => {
    const ev = bySource.get(s.id);
    if (!ev?.text?.trim()) {
      return { ...s, passages: s.passages || [] };
    }

    const passages: CitationPassage[] = [];
    for (const q of qs) {
      for (const p of findSupportingPassages(ev.text, q, { max: 1, windowChars: 240 })) {
        if (passages.some((x) => Math.abs(x.start - p.start) < 80)) continue;
        passages.push(p);
        if (passages.length >= 4) break;
      }
      if (passages.length >= 4) break;
    }

    // Fallback: title / snippet probe
    if (!passages.length && (s.title || s.snippet)) {
      passages.push(
        ...findSupportingPassages(ev.text, `${s.title || ""} ${s.snippet || ""}`, {
          max: 2,
          windowChars: 240,
        })
      );
    }

    const top = passages.slice(0, 4);
    return {
      ...s,
      passages: top.map((p) => ({
        text: p.text,
        start: p.start,
        end: p.end,
        score: Math.round(p.score * 100) / 100,
        query: p.query,
      })),
      snippet: s.snippet || top[0]?.text || s.snippet,
      passageCount: Math.max(s.passageCount || 0, top.length || 1),
    };
  });
}

/** Split text into highlightable segments for a set of passages. */
export function highlightSegments(
  text: string,
  needles: string[]
): { text: string; hit: boolean }[] {
  const body = String(text || "");
  if (!body || !needles.length) return [{ text: body, hit: false }];

  const clean = needles
    .map((n) => String(n || "").trim())
    .filter((n) => n.length >= 12)
    .slice(0, 6);
  if (!clean.length) return [{ text: body, hit: false }];

  type Mark = { start: number; end: number };
  const marks: Mark[] = [];
  const lower = body.toLowerCase();
  for (const n of clean) {
    const needle = n.toLowerCase().slice(0, 80);
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(needle.slice(0, Math.min(48, needle.length)), from);
      if (idx < 0) break;
      const end = Math.min(body.length, idx + Math.min(n.length, 120));
      marks.push({ start: idx, end });
      from = end;
    }
  }
  if (!marks.length) return [{ text: body, hit: false }];

  marks.sort((a, b) => a.start - b.start);
  const merged: Mark[] = [];
  for (const m of marks) {
    const last = merged[merged.length - 1];
    if (last && m.start <= last.end + 4) {
      last.end = Math.max(last.end, m.end);
    } else {
      merged.push({ ...m });
    }
  }

  const segs: { text: string; hit: boolean }[] = [];
  let cursor = 0;
  for (const m of merged) {
    if (m.start > cursor) segs.push({ text: body.slice(cursor, m.start), hit: false });
    segs.push({ text: body.slice(m.start, m.end), hit: true });
    cursor = m.end;
  }
  if (cursor < body.length) segs.push({ text: body.slice(cursor), hit: false });
  return segs;
}

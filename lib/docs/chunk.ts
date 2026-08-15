/**
 * Question-conditioned chunking for high-volume document summarization.
 * Industry pattern: overlapping windows (Map-Reduce / hierarchical summarize).
 */

export type TextChunk = {
  index: number;
  start: number;
  end: number;
  text: string;
  /** Higher when chunk overlaps decision-question tokens. */
  questionScore: number;
};

const STOP = new Set(
  "a an the and or but of to in on for with from by as at is are was were be been being this that these those it its their our your they we you i he she not no nor so if then than".split(
    /\s+/
  )
);

function questionTokens(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s%-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3 && !STOP.has(t))
    .slice(0, 20);
}

function scoreAgainstQuestion(text: string, tokens: string[]): number {
  if (!tokens.length) return 0;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const t of tokens) {
    if (lower.includes(t)) hits += 1;
  }
  return hits / tokens.length;
}

/**
 * Split long text into overlapping chunks. Prefer question-relevant segments first
 * when ranking (callers may map in score order then reduce chronologically).
 */
export function chunkDocumentText(
  text: string,
  opts?: {
    chunkChars?: number;
    overlapChars?: number;
    question?: string;
    maxChunks?: number;
  }
): TextChunk[] {
  const body = String(text || "").replace(/\s+/g, " ").trim();
  if (!body) return [];

  const chunkChars = opts?.chunkChars ?? 4_000;
  const overlapChars = opts?.overlapChars ?? 500;
  const maxChunks = opts?.maxChunks ?? 24;
  const tokens = questionTokens(opts?.question || "");

  if (body.length <= chunkChars) {
    return [
      {
        index: 0,
        start: 0,
        end: body.length,
        text: body,
        questionScore: scoreAgainstQuestion(body, tokens),
      },
    ];
  }

  const step = Math.max(800, chunkChars - overlapChars);
  const chunks: TextChunk[] = [];
  for (let start = 0, i = 0; start < body.length && i < maxChunks; i++) {
    const end = Math.min(body.length, start + chunkChars);
    const slice = body.slice(start, end);
    chunks.push({
      index: i,
      start,
      end,
      text: slice,
      questionScore: scoreAgainstQuestion(slice, tokens),
    });
    if (end >= body.length) break;
    start += step;
  }
  return chunks;
}

/** Prefer high questionScore chunks while keeping original order for reduce. */
export function selectChunksForMap(
  chunks: TextChunk[],
  limit: number
): TextChunk[] {
  if (chunks.length <= limit) return chunks;
  const ranked = [...chunks].sort((a, b) => b.questionScore - a.questionScore);
  const picked = new Set(ranked.slice(0, limit).map((c) => c.index));
  return chunks.filter((c) => picked.has(c.index));
}

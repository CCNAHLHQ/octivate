import { getOpenRouterClient } from "@/lib/openrouter/client";
import {
  getDocsFeatureClass,
  resolveDocsMaxTokens,
  resolveDocsModel,
} from "@/lib/openrouter/config";
import { readModelConfig } from "@/lib/openrouter/model-config-store";
import { chunkDocumentText, selectChunksForMap } from "@/lib/docs/chunk";
import {
  DOCUMENT_EXTRACTOR_SYSTEM,
  DOCUMENT_SUMMARIZER_MAP_SYSTEM,
  DOCUMENT_SUMMARIZER_REDUCE_SYSTEM,
  DOCUMENT_SUMMARIZER_SYSTEM,
} from "@/lib/docs/prompts";
import { extractDocumentText, patchDocumentMeta, type ProjectDocument } from "@/lib/docs/store";
import { sanitizeModelStrings, sanitizePlainText } from "@/lib/docs/sanitize-text";
import { readCollection } from "@/lib/store/json-store";
import { recordUsage } from "@/lib/usage/usage-store";
import { SEED_PROJECTS } from "@/lib/mock/seed";
import type { Project } from "@/lib/types";

export type DocumentSummaryResult = {
  status: string;
  summary: string;
  key_points: string[];
  decision_relevance: string;
  gaps: string[];
  risk_flags: string[];
  review_flags: string[];
  recommendation_hints?: string[];
  psn_hints?: {
    power: string[];
    systems: string[];
    narratives: string[];
  };
  /** stuff | map_reduce — which globally recognized pattern was used. */
  method?: "stuff" | "map_reduce" | "import_shortcut";
  chunk_count?: number;
};

/** Below this, stuff the whole extract in one call (classic "stuff" chain). */
const STUFF_CHAR_LIMIT = 8_000;
/** Hard ceiling of extract fed into map-reduce. */
const EXTRACT_CHAR_LIMIT = 80_000;
/** Max map chunks after question ranking. */
const MAX_MAP_CHUNKS = 10;

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const body = fence ? fence[1].trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model did not return JSON");
  return JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
}

function asStringArray(v: unknown, max = 24): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => sanitizePlainText(x, 2_000))
    .slice(0, max);
}

function asPsnHints(v: unknown): DocumentSummaryResult["psn_hints"] {
  if (!v || typeof v !== "object") return { power: [], systems: [], narratives: [] };
  const o = v as Record<string, unknown>;
  return {
    power: asStringArray(o.power, 8),
    systems: asStringArray(o.systems, 8),
    narratives: asStringArray(o.narratives, 8),
  };
}

function envelopeFromParsed(
  parsed: Record<string, unknown>,
  fallbackStatus: string
): DocumentSummaryResult {
  return {
    status:
      typeof parsed.status === "string"
        ? sanitizePlainText(parsed.status, 64)
        : fallbackStatus,
    summary: sanitizePlainText(
      typeof parsed.summary === "string"
        ? parsed.summary
        : typeof parsed.chunk_summary === "string"
          ? parsed.chunk_summary
          : "No summary produced.",
      4_000
    ),
    key_points: asStringArray(parsed.key_points),
    decision_relevance: sanitizePlainText(
      typeof parsed.decision_relevance === "string" ? parsed.decision_relevance : "",
      2_000
    ),
    gaps: asStringArray(parsed.gaps),
    risk_flags: asStringArray(parsed.risk_flags),
    review_flags: asStringArray(parsed.review_flags),
    recommendation_hints: asStringArray(parsed.recommendation_hints, 12),
    psn_hints: asPsnHints(parsed.psn_hints),
  };
}

type Spend = {
  tokensUsed: number;
  costUsd: number;
  usedModel: string;
  costSource: "openrouter" | "estimate" | "mixed";
  generationId?: string;
};

function accumulateSpend(
  spend: Spend,
  ex: {
    totalTokens?: number;
    costUsd?: number;
    model?: string;
    costSource?: string;
    generationId?: string;
  }
) {
  spend.tokensUsed += ex.totalTokens || 0;
  spend.costUsd += ex.costUsd || 0;
  spend.usedModel = ex.model || spend.usedModel;
  if (ex.costSource === "estimate") {
    spend.costSource = spend.costSource === "openrouter" ? "estimate" : "mixed";
  }
  if (ex.costSource === "mixed") spend.costSource = "mixed";
  if (ex.generationId) spend.generationId = ex.generationId;
}

export async function summarizeProjectDocument(opts: {
  projectId: string;
  docId: string;
  /** Optional operator guidance for rework / focused synthesis. */
  focus?: string;
}): Promise<{ project: Project; document: ProjectDocument; summary: DocumentSummaryResult }> {
  const projects = await readCollection<Project>("projects", SEED_PROJECTS);
  const project = projects.find((p) => p.id === opts.projectId);
  if (!project) throw new Error("Project not found");
  const doc = project.documents.find((d) => d.id === opts.docId) as ProjectDocument | undefined;
  if (!doc) throw new Error("Document not found");

  await readModelConfig();
  const docsFeature = getDocsFeatureClass();
  if (!docsFeature?.enabled) {
    throw new Error("Document summarization is disabled by the operator.");
  }

  const hadSummary = Boolean(doc.summary?.trim());
  if (hadSummary && docsFeature.allowRework === false) {
    throw new Error("Summary rework is disabled by the operator.");
  }

  const rawFocus = sanitizePlainText(opts.focus || "", 1_200);
  const focus = docsFeature.allowFocus ? rawFocus : "";
  if (rawFocus && !docsFeature.allowFocus) {
    throw new Error("Focus notes are disabled by the operator for document summaries.");
  }

  await patchDocumentMeta(opts.projectId, opts.docId, {
    summaryStatus: "running",
    summaryFocus: focus || undefined,
  });

  // Cost shortcut: re-uploaded Octivate briefs already carry structured extract.
  if (doc.kind === "octivate_brief" && doc.importPayload) {
    const p = doc.importPayload;
    const summary: DocumentSummaryResult = {
      status: "imported_octivate_brief",
      method: "import_shortcut",
      summary: sanitizePlainText(
        [
          `Recognized prior Octivate brief “${p.title}”.`,
          p.executiveSummary,
          "No LLM summarize run — structured fields reused for pipeline shortcut.",
        ].join(" "),
        4_000
      ),
      key_points: [
        ...p.recommendations.slice(0, 4),
        ...p.monitoring.slice(0, 2),
      ].map((x) => sanitizePlainText(x, 2_000)),
      decision_relevance: sanitizePlainText(
        p.analyticalJudgement || p.executiveSummary.slice(0, 800),
        2_000
      ),
      gaps: p.gaps.slice(0, 12).map((x) => sanitizePlainText(x, 2_000)),
      risk_flags: p.riskLevel ? [`risk:${p.riskLevel}`] : [],
      review_flags: ["import_shortcut_available", "llm_skipped"],
      recommendation_hints: p.recommendations.slice(0, 6).map((x) => sanitizePlainText(x, 800)),
      psn_hints: {
        power: (p.power || []).slice(0, 4),
        systems: (p.systems || []).slice(0, 4),
        narratives: (p.narratives || []).slice(0, 4),
      },
    };
    const { project: nextProject, document } = await patchDocumentMeta(opts.projectId, opts.docId, {
      summary: summary.summary,
      summaryStatus: "ready",
      summaryAt: new Date().toISOString(),
      summaryFocus: focus || undefined,
      summaryPayload: {
        status: summary.status,
        key_points: summary.key_points,
        decision_relevance: summary.decision_relevance,
        gaps: summary.gaps,
        risk_flags: summary.risk_flags,
        review_flags: summary.review_flags,
        recommendation_hints: summary.recommendation_hints,
        psn_hints: summary.psn_hints,
        method: summary.method,
      },
    });
    return { project: nextProject, document: document as ProjectDocument, summary };
  }

  const model = resolveDocsModel();
  const docsMaxTokens = resolveDocsMaxTokens();
  const spend: Spend = {
    tokensUsed: 0,
    costUsd: 0,
    usedModel: model,
    costSource: "openrouter",
  };

  try {
    const { text, mode } = await extractDocumentText(opts.projectId, doc, EXTRACT_CHAR_LIMIT);
    const client = getOpenRouterClient();
    const decisionQuestion = project.question || "";
    const decisionCtx = sanitizePlainText(
      [
        `Project: ${project.name}.`,
        `Country: ${project.country}.`,
        `Sector: ${project.sector}.`,
        `Question: ${decisionQuestion || "(none)"}.`,
        focus ? `Operator focus: ${focus}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      1_600
    );

    let extracted = text;
    // Light extractor polish only on the leading window (map-reduce covers the rest).
    if (mode === "text" && text.length > 80 && text.length <= STUFF_CHAR_LIMIT) {
      const ex = await client.complete({
        model,
        messages: [
          { role: "system", content: DOCUMENT_EXTRACTOR_SYSTEM },
          {
            role: "user",
            content: `${decisionCtx}\n\nDocument name: ${doc.name}\n\n--- DOCUMENT START ---\n${text.slice(0, 10_000)}\n--- DOCUMENT END ---`,
          },
        ],
        maxTokens: Math.min(docsMaxTokens + 200, 2200),
      });
      accumulateSpend(spend, ex);
      try {
        const parsed = sanitizeModelStrings(parseJsonObject(ex.content));
        if (typeof parsed.extracted_text === "string" && parsed.extracted_text.trim()) {
          extracted = sanitizePlainText(parsed.extracted_text, EXTRACT_CHAR_LIMIT);
        }
      } catch {
        /* keep raw extract */
      }
    }

    const focusBlock = focus
      ? `\n<<<OPERATOR_FOCUS_START>>>\n${focus}\n<<<OPERATOR_FOCUS_END>>>\n`
      : "";

    let summary: DocumentSummaryResult;

    if (extracted.length <= STUFF_CHAR_LIMIT) {
      // Classic "stuff" pattern — single call when volume fits.
      const sum = await client.complete({
        model,
        messages: [
          { role: "system", content: DOCUMENT_SUMMARIZER_SYSTEM },
          {
            role: "user",
            content: `${decisionCtx}\n${focusBlock}\nDocument name: ${doc.name} (${doc.type})\nExtract mode: ${mode}\nSummarize method: stuff\n\n--- EXTRACT START ---\n${extracted.slice(0, STUFF_CHAR_LIMIT)}\n--- EXTRACT END ---`,
          },
        ],
        maxTokens: docsMaxTokens,
      });
      accumulateSpend(spend, sum);
      const parsed = sanitizeModelStrings(parseJsonObject(sum.content));
      summary = {
        ...envelopeFromParsed(parsed, "partial"),
        method: "stuff",
        chunk_count: 1,
      };
    } else {
      // Map-Reduce / hierarchical summarize for high volume.
      const allChunks = chunkDocumentText(extracted, {
        chunkChars: 4_000,
        overlapChars: 500,
        question: `${decisionQuestion} ${focus}`.trim(),
        maxChunks: 24,
      });
      const mapChunks = selectChunksForMap(allChunks, MAX_MAP_CHUNKS);
      const mapOutputs: Record<string, unknown>[] = [];

      for (const chunk of mapChunks) {
        const mapRes = await client.complete({
          model,
          messages: [
            { role: "system", content: DOCUMENT_SUMMARIZER_MAP_SYSTEM },
            {
              role: "user",
              content: `${decisionCtx}\n${focusBlock}\nDocument: ${doc.name}\nChunk ${chunk.index + 1}/${allChunks.length} (chars ${chunk.start}-${chunk.end}, questionScore=${chunk.questionScore.toFixed(2)})\n\n--- CHUNK START ---\n${chunk.text}\n--- CHUNK END ---`,
            },
          ],
          maxTokens: Math.min(docsMaxTokens, 1200),
        });
        accumulateSpend(spend, mapRes);
        try {
          const parsed = sanitizeModelStrings(parseJsonObject(mapRes.content));
          mapOutputs.push({
            chunk_index: chunk.index,
            question_score: chunk.questionScore,
            ...parsed,
          });
        } catch {
          mapOutputs.push({
            chunk_index: chunk.index,
            status: "partial",
            chunk_summary: chunk.text.slice(0, 600),
            key_points: [],
            review_flags: ["map_parse_failed"],
          });
        }
      }

      const reducePayload = sanitizePlainText(JSON.stringify(mapOutputs), 24_000);
      const reduce = await client.complete({
        model,
        messages: [
          { role: "system", content: DOCUMENT_SUMMARIZER_REDUCE_SYSTEM },
          {
            role: "user",
            content: `${decisionCtx}\n${focusBlock}\nDocument name: ${doc.name} (${doc.type})\nSummarize method: map_reduce\nMap outputs (${mapOutputs.length} chunks of ${allChunks.length}):\n${reducePayload}`,
          },
        ],
        maxTokens: Math.min(docsMaxTokens + 400, 2800),
      });
      accumulateSpend(spend, reduce);
      const parsed = sanitizeModelStrings(parseJsonObject(reduce.content));
      summary = {
        ...envelopeFromParsed(parsed, "partial"),
        method: "map_reduce",
        chunk_count: mapOutputs.length,
        review_flags: [
          ...envelopeFromParsed(parsed, "partial").review_flags,
          `map_reduce_chunks:${mapOutputs.length}`,
        ],
      };
    }

    if (spend.tokensUsed > 0 || spend.costUsd > 0) {
      await recordUsage({
        tokens: spend.tokensUsed,
        cost: spend.costUsd,
        model: spend.usedModel,
        label: `Document summarize · ${doc.name} · ${summary.method || "stuff"}`,
        countSession: false,
        premium: false,
        channel: "docs",
        costSource: spend.costSource,
        generationId: spend.generationId,
      });
    }

    const { project: nextProject, document } = await patchDocumentMeta(opts.projectId, opts.docId, {
      summary: summary.summary,
      summaryStatus: "ready",
      summaryAt: new Date().toISOString(),
      summaryFocus: focus || undefined,
      summaryPayload: {
        status: summary.status,
        key_points: summary.key_points,
        decision_relevance: summary.decision_relevance,
        gaps: summary.gaps,
        risk_flags: summary.risk_flags,
        review_flags: summary.review_flags,
        recommendation_hints: summary.recommendation_hints,
        psn_hints: summary.psn_hints,
        method: summary.method,
        chunk_count: summary.chunk_count,
      },
    });

    return { project: nextProject, document: document as ProjectDocument, summary };
  } catch (err) {
    if (spend.tokensUsed > 0 || spend.costUsd > 0) {
      await recordUsage({
        tokens: spend.tokensUsed,
        cost: spend.costUsd,
        model: spend.usedModel,
        label: `Document summarize · ${doc.name} (failed)`,
        countSession: false,
        premium: false,
        channel: "docs",
        costSource: spend.costSource,
      }).catch(() => null);
    }
    await patchDocumentMeta(opts.projectId, opts.docId, { summaryStatus: "failed" }).catch(() => null);
    throw err instanceof Error ? err : new Error("Summarize failed");
  }
}

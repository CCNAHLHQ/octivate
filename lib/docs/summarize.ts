import { getOpenRouterClient } from "@/lib/openrouter/client";
import {
  getDocsFeatureClass,
  resolveDocsMaxTokens,
  resolveDocsModel,
} from "@/lib/openrouter/config";
import { readModelConfig } from "@/lib/openrouter/model-config-store";
import { extractDocumentText, patchDocumentMeta, type ProjectDocument } from "@/lib/docs/store";
import { DOCUMENT_EXTRACTOR_SYSTEM, DOCUMENT_SUMMARIZER_SYSTEM } from "@/lib/docs/prompts";
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
};

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const body = fence ? fence[1].trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model did not return JSON");
  return JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => sanitizePlainText(x, 2_000))
    .slice(0, 24);
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
      },
    });
    return { project: nextProject, document: document as ProjectDocument, summary };
  }

  const model = resolveDocsModel();
  const docsMaxTokens = resolveDocsMaxTokens();

  let tokensUsed = 0;
  let costUsd = 0;
  let usedModel = model;
  let costSource: "openrouter" | "estimate" | "mixed" = "openrouter";

  try {
    const { text, mode } = await extractDocumentText(opts.projectId, doc);
    const client = getOpenRouterClient();
    const decisionCtx = sanitizePlainText(
      [
        `Project: ${project.name}.`,
        `Country: ${project.country}.`,
        `Sector: ${project.sector}.`,
        `Question: ${project.question || "(none)"}.`,
        focus ? `Operator focus: ${focus}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      1_600
    );

    let extracted = text;
    if (mode === "text" && text.length > 80) {
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
      tokensUsed += ex.totalTokens || 0;
      costUsd += ex.costUsd || 0;
      usedModel = ex.model || usedModel;
      if (ex.costSource === "estimate") costSource = costSource === "openrouter" ? "estimate" : "mixed";
      if (ex.costSource === "mixed") costSource = "mixed";
      try {
        const parsed = sanitizeModelStrings(parseJsonObject(ex.content));
        if (typeof parsed.extracted_text === "string" && parsed.extracted_text.trim()) {
          extracted = sanitizePlainText(parsed.extracted_text, 12_000);
        }
      } catch {
        /* keep raw extract */
      }
    }

    const focusBlock = focus
      ? `\n<<<OPERATOR_FOCUS_START>>>\n${focus}\n<<<OPERATOR_FOCUS_END>>>\n`
      : "";

    const sum = await client.complete({
      model,
      messages: [
        { role: "system", content: DOCUMENT_SUMMARIZER_SYSTEM },
        {
          role: "user",
          content: `${decisionCtx}\n${focusBlock}\nDocument name: ${doc.name} (${doc.type})\nExtract mode: ${mode}\n\n--- EXTRACT START ---\n${extracted.slice(0, 10_000)}\n--- EXTRACT END ---`,
        },
      ],
      maxTokens: docsMaxTokens,
    });
    tokensUsed += sum.totalTokens || 0;
    costUsd += sum.costUsd || 0;
    usedModel = sum.model || usedModel;
    if (sum.costSource === "estimate") costSource = costSource === "openrouter" ? "estimate" : "mixed";
    if (sum.costSource === "mixed") costSource = "mixed";

    const parsed = sanitizeModelStrings(parseJsonObject(sum.content));
    const summary: DocumentSummaryResult = {
      status: typeof parsed.status === "string" ? sanitizePlainText(parsed.status, 64) : "partial",
      summary: sanitizePlainText(
        typeof parsed.summary === "string" ? parsed.summary : "No summary produced.",
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
    };

    if (tokensUsed > 0 || costUsd > 0) {
      await recordUsage({
        tokens: tokensUsed,
        cost: costUsd,
        model: usedModel,
        label: `Document summarize · ${doc.name}`,
        countSession: false,
        premium: false,
        channel: "docs",
        costSource,
        generationId: sum.generationId,
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
      },
    });

    return { project: nextProject, document: document as ProjectDocument, summary };
  } catch (err) {
    if (tokensUsed > 0 || costUsd > 0) {
      await recordUsage({
        tokens: tokensUsed,
        cost: costUsd,
        model: usedModel,
        label: `Document summarize · ${doc.name} (failed)`,
        countSession: false,
        premium: false,
        channel: "docs",
        costSource,
      }).catch(() => null);
    }
    await patchDocumentMeta(opts.projectId, opts.docId, { summaryStatus: "failed" }).catch(() => null);
    throw err instanceof Error ? err : new Error("Summarize failed");
  }
}

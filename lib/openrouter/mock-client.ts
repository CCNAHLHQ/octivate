import type { CompletionRequest, CompletionResult, OpenRouterClient } from "./client";
import { MODEL_RATES } from "./client";

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export class MockOpenRouterClient implements OpenRouterClient {
  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const model = req.model || "deepseek/deepseek-chat";
    const prompt = req.messages.map((m) => m.content).join("\n");
    const promptTokens = estimateTokens(prompt);
    const completionTokens = Math.min(req.maxTokens || 800, 400 + Math.floor(Math.random() * 200));
    const totalTokens = promptTokens + completionTokens;
    const rate = MODEL_RATES[model] ?? 0.3;
    const costUsd = (totalTokens / 1_000_000) * rate;

    const lastUser = [...req.messages].reverse().find((m) => m.role === "user")?.content || "";
    const content = [
      "Mock synthesis complete.",
      `Focus: ${lastUser.slice(0, 160)}${lastUser.length > 160 ? "…" : ""}`,
      "Evidence ranked by authority and recency. PSN framework applied.",
      "Confidence calibrated against corroboration and gap density.",
    ].join(" ");

    await new Promise((r) => setTimeout(r, 180 + Math.random() * 220));

    return {
      content,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd,
      costSource: "estimate",
    };
  }
}

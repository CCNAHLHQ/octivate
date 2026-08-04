import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { emitOpsEvent } from "@/lib/ops/event-log";
import {
  readModelConfig,
  resetModelConfig,
  writeModelConfig,
  type DocsFeatureClass,
  type ModelConfig,
  type ReasoningEffort,
} from "@/lib/openrouter/model-config-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const config = await readModelConfig();
  return jsonOk({ config });
}

export async function PATCH(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  if (!body || typeof body !== "object") return jsonError("Invalid body");
  const raw = body as Record<string, unknown>;

  if (raw.reset === true) {
    const config = await resetModelConfig();
    void emitOpsEvent({
      level: "info",
      source: "system",
      message: "model_config_reset",
      meta: { defaultModel: config.defaultModel },
    });
    return jsonOk({ config });
  }

  const patch: Partial<ModelConfig> = {};
  if (typeof raw.defaultModel === "string") patch.defaultModel = raw.defaultModel;
  if (typeof raw.premiumModel === "string") patch.premiumModel = raw.premiumModel;
  if (typeof raw.fallbackModel === "string") patch.fallbackModel = raw.fallbackModel;
  if (typeof raw.temperature === "number") patch.temperature = raw.temperature;
  if (typeof raw.doctrineMaxTokens === "number") patch.doctrineMaxTokens = raw.doctrineMaxTokens;
  if (typeof raw.reasoningMaxTokens === "number") patch.reasoningMaxTokens = raw.reasoningMaxTokens;
  if (typeof raw.reasoningBudget === "number") patch.reasoningBudget = raw.reasoningBudget;
  if (typeof raw.reasoningEffort === "string") {
    patch.reasoningEffort = raw.reasoningEffort as ReasoningEffort;
  }
  if (typeof raw.maxConcurrent === "number") patch.maxConcurrent = raw.maxConcurrent;
  if (typeof raw.timeoutMs === "number") patch.timeoutMs = raw.timeoutMs;
  if (Array.isArray(raw.allowlist)) {
    patch.allowlist = raw.allowlist.map(String).filter(Boolean);
  }
  if (raw.docs && typeof raw.docs === "object") {
    const d = raw.docs as Record<string, unknown>;
    const docsPatch: Partial<DocsFeatureClass> = {};
    if (typeof d.enabled === "boolean") docsPatch.enabled = d.enabled;
    if (typeof d.model === "string") docsPatch.model = d.model;
    if (typeof d.maxTokens === "number") docsPatch.maxTokens = d.maxTokens;
    if (typeof d.allowFocus === "boolean") docsPatch.allowFocus = d.allowFocus;
    if (typeof d.allowRework === "boolean") docsPatch.allowRework = d.allowRework;
    patch.docs = docsPatch as DocsFeatureClass;
  }

  const config = await writeModelConfig(patch);
  void emitOpsEvent({
    level: "info",
    source: "system",
    message: `model_config_updated · ${config.defaultModel}`,
    meta: {
      defaultModel: config.defaultModel,
      premiumModel: config.premiumModel,
      fallbackModel: config.fallbackModel,
      docsModel: config.docs.model,
      docsEnabled: config.docs.enabled,
    },
  });
  return jsonOk({ config });
}

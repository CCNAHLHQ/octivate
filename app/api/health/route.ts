import { NextRequest } from "next/server";
import { guardApi, jsonOk } from "@/lib/security/guard";
import {
  openRouterMode,
  openRouterModeSource,
  resolveModel,
  isMockOpenRouter,
} from "@/lib/openrouter/config";
import { getCachedModelConfig } from "@/lib/openrouter/model-config-store";
import { runDocumentRetentionMaintenance } from "@/lib/docs/retention";
import { runSourceProbeMaintenance } from "@/lib/sources/probe-maintenance";
import { normalizeLimits } from "@/lib/auth/profile-limits";
import { readOperatorLimits } from "@/lib/usage/usage-store";

export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;

  const mode = openRouterMode();
  const cfg = getCachedModelConfig();
  const limits = normalizeLimits(
    await readOperatorLimits().catch(() => null)
  );
  const allowPremium = Boolean(limits.allowPremiumModels);

  // Best-effort background maintenance; never block health on queue work.
  void runDocumentRetentionMaintenance().catch(() => null);
  void runSourceProbeMaintenance().catch(() => null);

  return jsonOk({
    status: "ok",
    service: "octivate",
    version: "0.2.0",
    time: new Date().toISOString(),
    mock: isMockOpenRouter(),
    interactive: !isMockOpenRouter() && Boolean(process.env.OPENROUTER_API_KEY),
    openRouter: {
      mode,
      source: openRouterModeSource(),
      keyConfigured: Boolean(process.env.OPENROUTER_API_KEY),
      defaultModel: resolveModel(false),
      premiumModel: cfg.premiumModel || process.env.OPENROUTER_PREMIUM_MODEL || null,
      allowPremiumModels: allowPremium,
      activeModel: resolveModel(allowPremium),
    },
    documentRetentionDays: limits.documentRetentionDays,
    protocol: "v0.2",
  });
}

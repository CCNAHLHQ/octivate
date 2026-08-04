import { NextRequest } from "next/server";
import { guardApi, jsonOk } from "@/lib/security/guard";
import { readModelConfig } from "@/lib/openrouter/model-config-store";

export const dynamic = "force-dynamic";

/** Authenticated clients — public docs feature-class capabilities (no doctrine secrets). */
export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  const config = await readModelConfig();
  const docs = config.docs;
  return jsonOk({
    featureClass: "document_tooling",
    enabled: docs.enabled,
    model: docs.model,
    maxTokens: docs.maxTokens,
    allowFocus: docs.allowFocus,
    allowRework: docs.allowRework,
  });
}

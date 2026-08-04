import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { DEFAULT_LIMITS } from "@/lib/mock/seed";
import { updateLimitsSchema } from "@/lib/validation/schemas";
import { invalidateRuntimeMockOverride } from "@/lib/openrouter/runtime-mode";
import { normalizeLimits } from "@/lib/auth/profile-limits";
import {
  applyDocumentRetentionPolicy,
  processDocumentDeletionQueue,
} from "@/lib/docs/retention";
import { appendAudit } from "@/lib/protocol/audit";
import { readOperatorLimits, writeOperatorLimits } from "@/lib/usage/usage-store";
import type { OperatorLimits } from "@/lib/types";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const raw = await readOperatorLimits().catch(() => DEFAULT_LIMITS);
  return jsonOk({ limits: normalizeLimits(raw) });
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

  const parsed = updateLimitsSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  const current = normalizeLimits(await readOperatorLimits());
  const { mockOpenRouter: _retired, ...patch } = parsed.data;
  const limits = normalizeLimits({
    ...current,
    ...patch,
    mockOpenRouter: false,
  });

  await writeOperatorLimits(limits);
  invalidateRuntimeMockOverride();

  let retention: {
    recomputed: number;
    queued: number;
    deleted: number;
  } | null = null;

  if (limits.documentRetentionDays !== current.documentRetentionDays) {
    await appendAudit({
      action: "data_retention_policy_updated",
      detail: `Document retention changed ${current.documentRetentionDays} → ${limits.documentRetentionDays} days`,
    });
    const applied = await applyDocumentRetentionPolicy({
      days: limits.documentRetentionDays,
      previousDays: current.documentRetentionDays,
    });
    const drained = await processDocumentDeletionQueue({ limit: 80 });
    retention = {
      recomputed: applied.recomputed,
      queued: applied.queued,
      deleted: drained.deleted,
    };
  }

  return jsonOk({ limits, retention });
}

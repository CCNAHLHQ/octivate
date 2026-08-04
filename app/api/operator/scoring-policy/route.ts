import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { readScoringPolicy, writeScoringPolicy } from "@/lib/evidence/scoring-policy";
import { scoringPolicySchema } from "@/lib/validation/schemas";
import { appendAudit } from "@/lib/protocol/audit";
import { emitOpsEvent } from "@/lib/ops/event-log";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const policy = await readScoringPolicy();
  return jsonOk({ policy });
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

  const parsed = scoringPolicySchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  const policy = await writeScoringPolicy(parsed.data);
  await appendAudit({
    action: "ops_scoring_policy_updated",
    detail: JSON.stringify(policy),
  });
  await emitOpsEvent({
    level: "info",
    source: "system",
    message: "Scoring policy updated",
    meta: { ...policy },
  });
  return jsonOk({ policy });
}

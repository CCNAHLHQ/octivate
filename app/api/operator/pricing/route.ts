import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { readBillingPlans, writeBillingPlans } from "@/lib/billing/plans-store";
import type { PlanDefinition, PlanId } from "@/lib/billing/plans";
import { ALL_PLAN_IDS } from "@/lib/billing/plans";

function validatePlans(input: unknown): PlanDefinition[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  const ids = new Set<PlanId>(ALL_PLAN_IDS);
  for (const plan of input) {
    if (!plan || typeof plan !== "object") return null;
    const p = plan as PlanDefinition;
    if (!ids.has(p.id)) return null;
    if (typeof p.name !== "string" || !p.name.trim()) return null;
    if (!Array.isArray(p.features)) return null;
    if (!p.prices || typeof p.prices !== "object") return null;
  }
  return input as PlanDefinition[];
}

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const plans = await readBillingPlans();
  return jsonOk({ plans });
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

  const raw = body && typeof body === "object" && "plans" in body
    ? (body as { plans: unknown }).plans
    : body;
  const plans = validatePlans(raw);
  if (!plans) return jsonError("Invalid plans payload");

  const saved = await writeBillingPlans(plans);
  return jsonOk({ plans: saved });
}

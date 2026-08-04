import { readObject, writeObject } from "@/lib/store/json-store";
import { PLANS, type PlanDefinition } from "@/lib/billing/plans";

const STORE_KEY = "billing-plans";

function clonePlans(plans: PlanDefinition[]): PlanDefinition[] {
  return JSON.parse(JSON.stringify(plans)) as PlanDefinition[];
}

export async function readBillingPlans(): Promise<PlanDefinition[]> {
  const stored = await readObject<PlanDefinition[]>(STORE_KEY, clonePlans(PLANS));
  if (Array.isArray(stored) && stored.length > 0) return stored;
  const seed = clonePlans(PLANS);
  await writeObject(STORE_KEY, seed);
  return seed;
}

export async function writeBillingPlans(plans: PlanDefinition[]): Promise<PlanDefinition[]> {
  const next = clonePlans(plans);
  await writeObject(STORE_KEY, next);
  return next;
}

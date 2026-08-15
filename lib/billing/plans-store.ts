import { readObject, writeObject } from "@/lib/store/json-store";
import { CATALOGUE_VERSION, PLANS, type PlanDefinition } from "@/lib/billing/plans";

const STORE_KEY = "billing-plans";
const VERSION_KEY = "billing-plans-version";

function clonePlans(plans: PlanDefinition[]): PlanDefinition[] {
  return JSON.parse(JSON.stringify(plans)) as PlanDefinition[];
}

export async function readBillingPlans(): Promise<PlanDefinition[]> {
  const version = await readObject<number>(VERSION_KEY, 0);
  if (version !== CATALOGUE_VERSION) {
    const seed = clonePlans(PLANS);
    await writeObject(STORE_KEY, seed);
    await writeObject(VERSION_KEY, CATALOGUE_VERSION);
    return seed;
  }
  const stored = await readObject<PlanDefinition[]>(STORE_KEY, clonePlans(PLANS));
  if (Array.isArray(stored) && stored.length > 0) return stored;
  const seed = clonePlans(PLANS);
  await writeObject(STORE_KEY, seed);
  await writeObject(VERSION_KEY, CATALOGUE_VERSION);
  return seed;
}

export async function writeBillingPlans(plans: PlanDefinition[]): Promise<PlanDefinition[]> {
  const next = clonePlans(plans);
  await writeObject(STORE_KEY, next);
  await writeObject(VERSION_KEY, CATALOGUE_VERSION);
  return next;
}

import { NextRequest } from "next/server";
import { guardApi, jsonOk } from "@/lib/security/guard";
import { readBillingPlans } from "@/lib/billing/plans-store";

/** Public catalogue for the pricing page (live operator-edited plans). */
export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  const plans = await readBillingPlans();
  return jsonOk({ plans });
}

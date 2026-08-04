import { NextRequest } from "next/server";
import { guardApi, jsonOk } from "@/lib/security/guard";
import { getOperatorLimits, toProfileLimitsPublic } from "@/lib/auth/profile-limits";

/** Public signup configuration (no auth required). */
export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  const limits = await getOperatorLimits();
  const profile = toProfileLimitsPublic(limits);
  return jsonOk({
    allowAutogenerateAccounts: profile.allowAutogenerateAccounts,
    profileLimits: profile,
  });
}

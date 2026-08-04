import { NextRequest } from "next/server";
import { guardApi, jsonOk, jsonCached } from "@/lib/security/guard";
import { readCollection } from "@/lib/store/json-store";
import { SEED_STAKEHOLDERS } from "@/lib/mock/seed";
import type { Stakeholder } from "@/lib/types";

export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  const stakeholders = await readCollection<Stakeholder>(
    "stakeholders",
    SEED_STAKEHOLDERS
  );
  return jsonCached({ stakeholders });
}

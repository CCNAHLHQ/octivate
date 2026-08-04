import { NextRequest } from "next/server";
import { guardApi, jsonOk, jsonCached } from "@/lib/security/guard";
import { readCollection } from "@/lib/store/json-store";
import { SEED_TRENDS } from "@/lib/mock/seed";
import type { Trend } from "@/lib/types";

export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  const trends = await readCollection<Trend>("trends", SEED_TRENDS);
  return jsonCached({ trends });
}

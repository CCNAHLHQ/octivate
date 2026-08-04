import { NextRequest } from "next/server";
import { guardApi, jsonOk, jsonCached } from "@/lib/security/guard";
import { readCollection } from "@/lib/store/json-store";
import { SEED_PACKS } from "@/lib/mock/seed";
import type { CountryPack } from "@/lib/types";

export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  const packs = await readCollection<CountryPack>("packs", SEED_PACKS);
  return jsonCached({ packs });
}

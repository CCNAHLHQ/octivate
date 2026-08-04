import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { readCollection } from "@/lib/store/json-store";
import { normalizeBrief } from "@/lib/briefs/normalize";
import { SEED_BRIEFS } from "@/lib/mock/seed";
import type { Brief } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req);
  if (denied) return denied;
  const { id } = await params;
  const briefs = await readCollection<Brief>("briefs", SEED_BRIEFS);
  const brief = briefs.find((b) => b.id === id);
  if (!brief) return jsonError("Brief not found", 404);
  return jsonOk({ brief: normalizeBrief(brief) });
}

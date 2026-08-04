import { NextRequest } from "next/server";
import { guardApi, jsonOk } from "@/lib/security/guard";
import { TOPIC_TEMPLATES } from "@/lib/topics/templates";
import { readCollection } from "@/lib/store/json-store";
import { SEED_TRENDS } from "@/lib/mock/seed";
import type { Trend } from "@/lib/types";

export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;

  const trends = await readCollection<Trend>("trends", SEED_TRENDS);
  const hot = [...trends]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 12);

  return jsonOk({
    templates: TOPIC_TEMPLATES,
    hotTopics: hot,
  });
}

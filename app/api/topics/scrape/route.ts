import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { scrapeCaribbeanTopics } from "@/lib/topics/scraper";

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { topics: true });
  if (denied) return denied;
  try {
    const result = await scrapeCaribbeanTopics();
    return jsonOk(result);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Scrape failed", 500);
  }
}

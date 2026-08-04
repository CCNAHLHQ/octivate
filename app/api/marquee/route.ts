import { NextRequest } from "next/server";
import { guardApi, jsonCached, jsonError, jsonOk } from "@/lib/security/guard";
import { readCollection, writeCollection, uid } from "@/lib/store/json-store";
import { SEED_MARQUEE } from "@/lib/mock/seed";
import { createMarqueeSchema } from "@/lib/validation/schemas";
import type { MarqueeItem } from "@/lib/types";

function sortMarquee(items: MarqueeItem[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

/** Public read — enabled items only (site ticker). */
export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;

  const { searchParams } = req.nextUrl;
  const all = searchParams.get("all") === "1";

  const items = await readCollection<MarqueeItem>("marquee", SEED_MARQUEE);
  const sorted = sortMarquee(items);

  if (all) {
    return jsonCached({ items: sorted });
  }

  return jsonCached({ items: sorted.filter((item) => item.enabled) });
}

export async function POST(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const parsed = createMarqueeSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  const items = await readCollection<MarqueeItem>("marquee", SEED_MARQUEE);
  const sortOrder =
    items.length > 0 ? Math.max(...items.map((item) => item.sortOrder)) + 1 : 0;

  const item: MarqueeItem = {
    id: uid("mq"),
    badge: parsed.data.badge.toUpperCase(),
    kind: parsed.data.kind,
    text: parsed.data.text.trim(),
    enabled: parsed.data.enabled ?? true,
    sortOrder,
    createdAt: new Date().toISOString(),
  };

  items.push(item);
  await writeCollection("marquee", items);
  return jsonOk({ item }, { status: 201 });
}

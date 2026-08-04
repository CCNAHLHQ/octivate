import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { readCollection, removeFromCollection, writeCollection } from "@/lib/store/json-store";
import { SEED_MARQUEE } from "@/lib/mock/seed";
import { updateMarqueeSchema } from "@/lib/validation/schemas";
import type { MarqueeItem } from "@/lib/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req);
  if (denied) return denied;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const parsed = updateMarqueeSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  const items = await readCollection<MarqueeItem>("marquee", SEED_MARQUEE);
  const idx = items.findIndex((item) => item.id === id);
  if (idx < 0) return jsonError("Marquee item not found", 404);

  const current = items[idx];
  items[idx] = {
    ...current,
    ...parsed.data,
    badge: parsed.data.badge ? parsed.data.badge.toUpperCase() : current.badge,
    text: parsed.data.text?.trim() ?? current.text,
  };

  await writeCollection("marquee", items);
  return jsonOk({ item: items[idx] });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req);
  if (denied) return denied;

  const { id } = await params;
  const { removed } = await removeFromCollection<MarqueeItem>("marquee", id, SEED_MARQUEE);
  if (!removed) return jsonError("Marquee item not found", 404);
  return jsonOk({ ok: true, item: removed });
}

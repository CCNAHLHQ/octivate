import { NextRequest } from "next/server";
import { z } from "zod";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import {
  deleteModerationRecord,
  isModerationCollection,
  listModerationInventory,
  MODERATION_COLLECTIONS,
  MODERATION_LABELS,
} from "@/lib/moderation/collections";
import { isModerationReadOnly } from "@/lib/moderation/constants";
import { upsertFlag } from "@/lib/moderation/flags";
import { emitOpsEvent } from "@/lib/ops/event-log";

const deleteSchema = z.object({
  collection: z.enum(MODERATION_COLLECTIONS),
  id: z.string().min(1),
});

const patchSchema = z.object({
  collection: z.enum(MODERATION_COLLECTIONS),
  id: z.string().min(1),
  flagged: z.boolean().optional(),
  hidden: z.boolean().optional(),
  note: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;

  const inventory = await listModerationInventory();
  const counts = Object.fromEntries(
    MODERATION_COLLECTIONS.map((key) => [key, inventory[key].length])
  ) as Record<(typeof MODERATION_COLLECTIONS)[number], number>;

  return jsonOk({
    labels: MODERATION_LABELS,
    counts,
    inventory,
  });
}

export async function PATCH(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Invalid patch payload");
  }

  const { collection, id, flagged, hidden, note } = parsed.data;
  if (isModerationReadOnly(collection)) {
    return jsonError("Collection is read-only", 400);
  }

  const flag = await upsertFlag(collection, id, { flagged, hidden, note });
  void emitOpsEvent({
    level: "info",
    source: "system",
    message: `moderation_${flag.flagged ? "flag" : "unflag"}${flag.hidden ? "_hidden" : ""}`,
    meta: { collection, id },
  });
  return jsonOk({ ok: true, flag });
}

export async function DELETE(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Invalid delete payload");
  }

  const { collection, id } = parsed.data;
  if (!isModerationCollection(collection)) {
    return jsonError("Unknown collection", 400);
  }
  if (isModerationReadOnly(collection)) {
    return jsonError("Collection is read-only", 400);
  }

  const result = await deleteModerationRecord(collection, id);
  if (!result) {
    return jsonError("Record not found", 404);
  }

  void emitOpsEvent({
    level: "warn",
    source: "system",
    message: `moderation_delete · ${result.collection}`,
    meta: { id: result.id, title: result.title },
  });

  return jsonOk({
    ok: true,
    deleted: result,
    message: buildDeleteMessage(result.collection, result.title, result.cascaded),
  });
}

const SINGULAR: Record<(typeof MODERATION_COLLECTIONS)[number], string> = {
  projects: "project",
  briefs: "brief",
  monitors: "monitor",
  "mailing-list": "subscriber",
  "agent-sessions": "agent session",
  costs: "cost entry",
  audit: "audit entry",
  "support-threads": "support thread",
};

function buildDeleteMessage(
  collection: (typeof MODERATION_COLLECTIONS)[number],
  title: string,
  cascaded: { collection: (typeof MODERATION_COLLECTIONS)[number]; count: number }[]
) {
  const short = title.length > 48 ? `${title.slice(0, 48)}…` : title;
  const base = `Deleted ${SINGULAR[collection]}: ${short}`;
  if (cascaded.length === 0) return base;
  const extra = cascaded
    .map((c) => `${c.count} ${MODERATION_LABELS[c.collection].toLowerCase()}`)
    .join(", ");
  return `${base} (also removed ${extra})`;
}

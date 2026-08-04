import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { readCollection, writeCollection } from "@/lib/store/json-store";
import { SEED_MONITORS } from "@/lib/mock/seed";
import { updateMonitorSchema } from "@/lib/validation/schemas";
import type { Monitor } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req);
  if (denied) return denied;
  const { id } = await params;
  const monitors = await readCollection<Monitor>("monitors", SEED_MONITORS);
  const monitor = monitors.find((m) => m.id === id);
  if (!monitor) return jsonError("Monitor not found", 404);
  return jsonOk({ monitor });
}

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

  const parsed = updateMonitorSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  const monitors = await readCollection<Monitor>("monitors", SEED_MONITORS);
  const idx = monitors.findIndex((m) => m.id === id);
  if (idx < 0) return jsonError("Monitor not found", 404);

  const { projectId, ...rest } = parsed.data;
  const next: Monitor = { ...monitors[idx], ...rest };
  if (projectId !== undefined) {
    if (projectId === null) delete next.projectId;
    else next.projectId = projectId;
  }
  monitors[idx] = next;
  await writeCollection("monitors", monitors);
  return jsonOk({ monitor: monitors[idx] });
}

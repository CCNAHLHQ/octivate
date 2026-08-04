import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk, jsonCached } from "@/lib/security/guard";
import { readCollection, writeCollection, uid } from "@/lib/store/json-store";
import { SEED_MONITORS } from "@/lib/mock/seed";
import { createMonitorSchema } from "@/lib/validation/schemas";
import type { Monitor } from "@/lib/types";

export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  const monitors = await readCollection<Monitor>("monitors", SEED_MONITORS);
  return jsonCached({ monitors });
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

  const parsed = createMonitorSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  const monitors = await readCollection<Monitor>("monitors", SEED_MONITORS);
  const monitor: Monitor = {
    id: uid("mon"),
    name: parsed.data.name,
    keywords: parsed.data.keywords,
    countries: parsed.data.countries,
    status: "active",
    alertCount: 0,
    ...(parsed.data.projectId ? { projectId: parsed.data.projectId } : {}),
  };
  monitors.unshift(monitor);
  await writeCollection("monitors", monitors);
  return jsonOk({ monitor }, { status: 201 });
}

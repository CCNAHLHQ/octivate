import { NextRequest } from "next/server";
import { z } from "zod";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { appendAudit } from "@/lib/protocol/audit";
import {
  normalizeProbeConfig,
  readProbeConfig,
  writeProbeConfig,
} from "@/lib/sources/probe-config";
import { runSourceProbeBatch, sourceHealthStats } from "@/lib/sources/probe";
import { SEED_SOURCES } from "@/lib/mock/seed";
import { readCollection } from "@/lib/store/json-store";
import type { Source } from "@/lib/types";

/** Coerce + clamp so autosave never 400s on transient UI values. */
const clampedInt = (min: number, max: number) =>
  z.coerce.number().transform((n) => {
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, Math.round(n)));
  });

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  intervalHours: clampedInt(1, 168).optional(),
  staleAfterHours: clampedInt(1, 720).optional(),
  concurrency: clampedInt(1, 8).optional(),
  timeoutMs: clampedInt(2000, 30_000).optional(),
  perDomainGapMs: clampedInt(250, 30_000).optional(),
  batchSize: clampedInt(1, 40).optional(),
  captureEnabled: z.boolean().optional(),
  captureMaxVersions: clampedInt(1, 30).optional(),
  captureMaxHtmlBytes: clampedInt(50_000, 8_000_000).optional(),
});

const postSchema = z.object({
  mode: z.enum(["stale", "all", "one"]).default("stale"),
  sourceId: z.string().min(1).optional(),
});

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const config = await readProbeConfig();
  const sources = await readCollection<Source>("sources", SEED_SOURCES);
  return jsonOk({ config, stats: sourceHealthStats(sources) });
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
    const msg = parsed.error.issues.map((i) => i.message).join("; ") || "Invalid probe config";
    return jsonError(msg);
  }

  const current = await readProbeConfig();
  const config = await writeProbeConfig(normalizeProbeConfig({ ...current, ...parsed.data }));
  await appendAudit({
    action: "source_probe_config_updated",
    detail: `Probe config updated · enabled=${config.enabled} interval=${config.intervalHours}h stale=${config.staleAfterHours}h capture=${config.captureEnabled}`,
  });
  return jsonOk({ config });
}

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = postSchema.safeParse(body ?? {});
  if (!parsed.success) return jsonError(parsed.error.message);
  if (parsed.data.mode === "one" && !parsed.data.sourceId) {
    return jsonError("sourceId required for mode=one");
  }

  try {
    const report = await runSourceProbeBatch({
      mode: parsed.data.mode,
      sourceId: parsed.data.sourceId,
      force: true,
    });
    const sources = await readCollection<Source>("sources", SEED_SOURCES);
    return jsonOk({ report, stats: sourceHealthStats(sources) });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Probe failed", 400);
  }
}

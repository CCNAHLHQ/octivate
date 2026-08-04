import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { readCollection, writeCollection } from "@/lib/store/json-store";
import { SEED_MONITORS, SEED_TRENDS, SEED_MARQUEE } from "@/lib/mock/seed";
import { collectMonitorSignals } from "@/lib/workspace/monitor-signals";
import type { MarqueeItem, Monitor, Trend } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req);
  if (denied) return denied;
  const { id } = await params;

  const [monitors, trends, marquee] = await Promise.all([
    readCollection<Monitor>("monitors", SEED_MONITORS),
    readCollection<Trend>("trends", SEED_TRENDS),
    readCollection<MarqueeItem>("marquee", SEED_MARQUEE),
  ]);

  const idx = monitors.findIndex((m) => m.id === id);
  if (idx < 0) return jsonError("Monitor not found", 404);

  const monitor = monitors[idx];
  const signals = collectMonitorSignals(monitor, trends, marquee);

  const latestAt = signals[0]?.publishedAt;
  const nextCount = Math.max(monitor.alertCount, signals.length);
  if (nextCount !== monitor.alertCount || (latestAt && latestAt !== monitor.lastAlertAt)) {
    monitors[idx] = {
      ...monitor,
      alertCount: nextCount,
      lastAlertAt: latestAt ?? monitor.lastAlertAt,
    };
    await writeCollection("monitors", monitors);
  }

  return jsonOk({ signals, monitor: monitors[idx] });
}

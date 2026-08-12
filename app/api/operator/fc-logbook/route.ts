import { NextRequest } from "next/server";
import { requireOperatorUser, resolveRequestUser } from "@/lib/auth/scope";
import {
  fcKeyFromDate,
  loadFcEntries,
  recentFcKeys,
  yesterdayFcKey,
} from "@/lib/future-caribbean/entries";
import { readFcJob } from "@/lib/future-caribbean/job-store";
import { startFcLogbookSync } from "@/lib/future-caribbean/start-sync";
import {
  FC_PUBLISH_TARGET,
  FC_PUBLISH_TARGET_LABEL,
  fcCredentials,
} from "@/lib/future-caribbean/config";
import type { FcSyncMode } from "@/lib/future-caribbean/types";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";

function parseMode(raw: unknown): FcSyncMode {
  if (raw === "recent" || raw === "all" || raw === "missing") return raw;
  return "missing";
}

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true, progress: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  const job = await readFcJob();
  const { days, weeks, meta } = await loadFcEntries();
  const creds = fcCredentials();
  const todayKey = fcKeyFromDate();
  const yesterdayKey = yesterdayFcKey();
  const recentKeys = recentFcKeys();
  const byKey = new Map(days.map((d) => [d.key, d]));

  return jsonOk({
    publishTarget: FC_PUBLISH_TARGET,
    publishTargetLabel: FC_PUBLISH_TARGET_LABEL,
    credentialsConfigured: Boolean(creds.email && creds.password),
    plannedDays: days.length,
    todayKey,
    yesterdayKey,
    recentKeys,
    meta,
    weeks: weeks.map((w) => ({
      label: w.label,
      days: w.days.map((d) => ({
        key: d.key,
        weekLabel: d.weekLabel,
        title: d.title,
        screenshot: d.screenshot,
        chars: d.body.length,
        isToday: d.key === todayKey,
        isYesterday: d.key === yesterdayKey,
      })),
    })),
    recentDays: recentKeys
      .map((key) => byKey.get(key))
      .filter(Boolean)
      .map((d) => ({
        key: d!.key,
        weekLabel: d!.weekLabel,
        title: d!.title,
        screenshot: d!.screenshot,
        chars: d!.body.length,
        isToday: d!.key === todayKey,
        isYesterday: d!.key === yesterdayKey,
      })),
    days: days.map((d) => ({
      key: d.key,
      weekLabel: d.weekLabel,
      title: d.title,
      screenshot: d.screenshot,
      chars: d.body.length,
      isToday: d.key === todayKey,
      isYesterday: d.key === yesterdayKey,
    })),
    job,
  });
}

export async function POST(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  let body: { mode?: unknown; auto?: unknown } = {};
  try {
    body = (await req.json()) as { mode?: unknown; auto?: unknown };
  } catch {
    body = {};
  }

  const result = await startFcLogbookSync({
    mode: parseMode(body.mode),
    auto: Boolean(body.auto),
  });
  if (!result.started) {
    const status = result.error === "sync_already_running" ? 409 : 400;
    return jsonError(result.error || "sync_failed", status);
  }
  return jsonOk({
    started: true,
    mode: result.job.mode || "missing",
    auto: Boolean(result.job.auto),
    publishTarget: FC_PUBLISH_TARGET,
    publishTargetLabel: FC_PUBLISH_TARGET_LABEL,
    job: result.job,
  });
}

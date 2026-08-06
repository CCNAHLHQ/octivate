import { NextRequest } from "next/server";
import { requireOperatorUser, resolveRequestUser } from "@/lib/auth/scope";
import { loadFcEntries } from "@/lib/future-caribbean/entries";
import { readFcJob } from "@/lib/future-caribbean/job-store";
import { startFcLogbookSync } from "@/lib/future-caribbean/start-sync";
import {
  FC_PUBLISH_TARGET,
  FC_PUBLISH_TARGET_LABEL,
  fcCredentials,
} from "@/lib/future-caribbean/config";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true, progress: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  const job = await readFcJob();
  const { days, meta } = await loadFcEntries();
  const creds = fcCredentials();

  return jsonOk({
    publishTarget: FC_PUBLISH_TARGET,
    publishTargetLabel: FC_PUBLISH_TARGET_LABEL,
    credentialsConfigured: Boolean(creds.email && creds.password),
    plannedDays: days.length,
    meta,
    days: days.map((d) => ({
      key: d.key,
      weekLabel: d.weekLabel,
      title: d.title,
      screenshot: d.screenshot,
      chars: d.body.length,
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

  const result = await startFcLogbookSync();
  if (!result.started) {
    const status = result.error === "sync_already_running" ? 409 : 400;
    return jsonError(result.error || "sync_failed", status);
  }
  return jsonOk({
    started: true,
    publishTarget: FC_PUBLISH_TARGET,
    publishTargetLabel: FC_PUBLISH_TARGET_LABEL,
    job: result.job,
  });
}

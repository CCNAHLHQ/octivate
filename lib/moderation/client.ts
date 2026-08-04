import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { notifyWorkspaceRefresh } from "@/lib/workspace-events";
import type { ModerationCollection } from "@/lib/moderation/constants";

export async function moderateDelete(collection: ModerationCollection, id: string) {
  const res = await apiFetch<{ ok: boolean; message: string }>("/api/operator/moderation", {
    method: "DELETE",
    json: { collection, id },
  });
  invalidateApiCache("/api/");
  notifyWorkspaceRefresh("all");
  return res;
}

export async function moderatePatch(
  collection: ModerationCollection,
  id: string,
  patch: { flagged?: boolean; hidden?: boolean; note?: string }
) {
  const res = await apiFetch<{ ok: boolean }>("/api/operator/moderation", {
    method: "PATCH",
    json: { collection, id, ...patch },
  });
  invalidateApiCache("/api/operator/moderation");
  return res;
}

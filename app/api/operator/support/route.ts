import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import {
  appendSupportMessage,
  archiveClosedSupportThreads,
  archiveSupportThread,
  assignSupportStaff,
  getSupportThread,
  leanThread,
  listSupportThreads,
  publicThread,
  setSupportStatus,
  subscribeSupport,
} from "@/lib/support/store";
import { OPERATOR_QUICK_REPLIES, type SupportThreadStatus } from "@/lib/support/types";
import { requireOperatorUser, resolveRequestUser } from "@/lib/auth/scope";
import { staffById } from "@/lib/support/staff";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  const id = req.nextUrl.searchParams.get("id") || "";
  if (id) {
    const thread = await getSupportThread(id);
    if (!thread) return jsonError("Not found", 404);
    return jsonOk({ thread: publicThread(thread) });
  }

  const threads = (await listSupportThreads()).map(leanThread);
  return jsonOk({
    threads,
    open: threads.filter((t) => t.status !== "closed").length,
    quickReplies: OPERATOR_QUICK_REPLIES,
  });
}

export async function PATCH(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }
  const raw = (body || {}) as Record<string, unknown>;
  const id = String(raw.id || "");

  try {
    if (raw.archiveAllClosed) {
      const result = await archiveClosedSupportThreads();
      const threads = (await listSupportThreads()).map(leanThread);
      return jsonOk({
        ...result,
        threads,
        open: threads.filter((t) => t.status !== "closed").length,
      });
    }

    if (!id) return jsonError("id required");

    if (raw.archive) {
      const thread = await archiveSupportThread(id);
      return jsonOk({ thread: publicThread(thread), archived: true });
    }

    const profile =
      staffById(gate.user.staffProfileId) ||
      staffById(String(raw.staffProfileId || "")) ||
      null;
    const staffName =
      profile?.name ||
      gate.user.displayName ||
      gate.user.username ||
      "Operator";
    const staffProfileId = profile?.id || gate.user.staffProfileId;

    if (typeof raw.status === "string") {
      const thread = await setSupportStatus(id, raw.status as SupportThreadStatus);
      return jsonOk({ thread: publicThread(thread) });
    }

    const wantsReply = Boolean(
      raw.quickReplyId || raw.body || (Array.isArray(raw.attachments) && raw.attachments.length)
    );
    if (raw.assign && !wantsReply) {
      if (!staffName) return jsonError("Staff identity required", 403);
      const thread = await assignSupportStaff(id, staffProfileId, staffName);
      return jsonOk({ thread: publicThread(thread) });
    }

    if (wantsReply) {
      let text = String(raw.body || "");
      let quickReplyId: string | undefined;
      if (raw.quickReplyId) {
        const canned = OPERATOR_QUICK_REPLIES.find(
          (q) => q.id === String(raw.quickReplyId)
        );
        if (canned) {
          text = canned.body;
          quickReplyId = canned.id;
        }
      }
      const thread = await appendSupportMessage({
        threadId: id,
        role: "operator",
        body: text,
        asOperator: true,
        staffProfileId,
        staffName,
        quickReplyId,
        attachments: raw.attachments,
      });
      return jsonOk({ thread: publicThread(thread) });
    }

    const thread = await getSupportThread(id);
    if (!thread) return jsonError("Not found", 404);
    return jsonOk({ thread: publicThread(thread) });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Update failed", 400);
  }
}

export { subscribeSupport };

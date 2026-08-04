import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { requireOperatorUser, resolveRequestUser } from "@/lib/auth/scope";
import {
  listUsers,
  resetUserPassword,
  setUserDisabled,
  toPublicUser,
} from "@/lib/auth/users";
import { readCollection } from "@/lib/store/json-store";
import type { MailingSubscriber } from "@/lib/types";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  const users = await listUsers();
  const mailing = await readCollection<MailingSubscriber>("mailing-list", []);
  const operators = users.filter((u) => u.role === "operator" && !u.disabled).length;
  const members = users.filter((u) => u.role === "member" && !u.disabled).length;
  const disabled = users.filter((u) => Boolean(u.disabled)).length;
  const registered = members + operators;
  const total = users.length;
  const mailingActive = mailing.filter((m) => m.status !== "unsubscribed").length;

  return jsonOk({
    stats: {
      total,
      registered,
      operators,
      members,
      disabled,
      mailingActive,
      mailingTotal: mailing.length,
    },
    users: users.map(toPublicUser),
    mailing,
  });
}

export async function PATCH(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  let body: { id?: string; action?: "disable" | "enable" | "reset-password" };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }
  const id = String(body.id || "");
  if (!id) return jsonError("id required");

  const users = await listUsers();
  const target = users.find((u) => u.id === id);
  if (!target) return jsonError("User not found", 404);
  if (target.role === "operator" && target.staffProfileId) {
    return jsonError("Founder operator accounts cannot be moderated here", 403);
  }

  if (body.action === "disable" || body.action === "enable") {
    const updated = await setUserDisabled(id, body.action === "disable");
    return jsonOk({ user: updated ? toPublicUser(updated) : null });
  }
  if (body.action === "reset-password") {
    const password = await resetUserPassword(id);
    return jsonOk({ password, message: "Password reset — share securely once." });
  }
  return jsonError("Unknown action");
}

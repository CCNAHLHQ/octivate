import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { requireOperatorUser, resolveRequestUser } from "@/lib/auth/scope";
import {
  listMerchantOrders,
  updateMerchantOrderStatus,
  type MerchantOrderStatus,
} from "@/lib/billing/merchant-orders";

const STATUSES = new Set<MerchantOrderStatus>([
  "submitted",
  "awaiting_provider",
  "paid",
  "cancelled",
  "failed",
]);

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  const url = req.nextUrl;
  const page = Math.max(1, Number(url.searchParams.get("page") || 1) || 1);
  const pageSize = Math.min(
    50,
    Math.max(5, Number(url.searchParams.get("pageSize") || 8) || 8)
  );
  const statusFilter = String(url.searchParams.get("status") || "").trim();

  const all = await listMerchantOrders();
  const filtered = statusFilter
    ? all.filter((o) => o.status === statusFilter)
    : all;
  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const orders = filtered.slice(start, start + pageSize);

  return jsonOk({
    orders,
    page: safePage,
    pageSize,
    pageCount,
    total,
    counts: {
      total: all.length,
      awaiting: all.filter((o) => o.status === "awaiting_provider").length,
      paid: all.filter((o) => o.status === "paid").length,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const user = await resolveRequestUser(req);
  const gate = requireOperatorUser(user);
  if (!gate.ok) return jsonError(gate.error, gate.status);

  let body: { id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const id = String(body.id || "").trim();
  const status = String(body.status || "") as MerchantOrderStatus;
  if (!id) return jsonError("Order id required");
  if (!STATUSES.has(status)) return jsonError("Invalid status");

  const updated = await updateMerchantOrderStatus(id, status);
  if (!updated) return jsonError("Order not found", 404);
  return jsonOk({ order: updated });
}

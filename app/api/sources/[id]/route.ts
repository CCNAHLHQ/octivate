import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { deleteSource, patchSource } from "@/lib/sources/update";
import { updateSourceSchema } from "@/lib/validation/schemas";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!id?.trim()) return jsonError("Missing source id", 400);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const parsed = updateSourceSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  try {
    const source = await patchSource(id, parsed.data);
    return jsonOk({ source });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return jsonError(message, /not found/i.test(message) ? 404 : 400);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(_req, { operator: true });
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!id?.trim()) return jsonError("Missing source id", 400);

  try {
    const { deleted } = await deleteSource(id);
    return jsonOk({ ok: true, deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return jsonError(message, /not found/i.test(message) ? 404 : 400);
  }
}

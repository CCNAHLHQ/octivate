import { NextRequest } from "next/server";
import { guardApi, jsonOk } from "@/lib/security/guard";
import { readUsage } from "@/lib/usage/usage-store";

export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;
  const usage = await readUsage();
  return jsonOk({ usage });
}

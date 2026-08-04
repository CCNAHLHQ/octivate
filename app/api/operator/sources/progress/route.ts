import { NextRequest } from "next/server";
import { guardApi, jsonOk } from "@/lib/security/guard";
import { getAllJobProgress } from "@/lib/sources/job-progress";

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true, progress: true });
  if (denied) return denied;
  return jsonOk(getAllJobProgress());
}

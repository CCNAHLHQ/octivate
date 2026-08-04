import { NextRequest } from "next/server";
import { guardApi, jsonError, jsonOk, jsonCached } from "@/lib/security/guard";
import { readCollection, writeCollection, uid } from "@/lib/store/json-store";
import { SEED_BRIEFS } from "@/lib/mock/seed";
import { createBriefSchema } from "@/lib/validation/schemas";
import { latestBriefForProject, repairBriefLinks } from "@/lib/briefs/link-repair";
import type { Brief } from "@/lib/types";

export async function GET(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;

  // Keep historical briefs wired to sessions/projects on every list.
  const repaired = await repairBriefLinks(true);
  const projectId = req.nextUrl.searchParams.get("projectId");
  const briefs = projectId
    ? repaired.briefs.filter((b) => b.projectId === projectId)
    : repaired.briefs;

  const latest = projectId ? latestBriefForProject(repaired.briefs, projectId) : null;

  return jsonCached({
    briefs,
    latestBriefId: latest?.id ?? null,
    repair: {
      briefSessionBackfill: repaired.briefSessionBackfill,
      sessionBriefBackfill: repaired.sessionBriefBackfill,
      syntheticSessions: repaired.syntheticSessions,
      staleSessionBriefCleared: repaired.staleSessionBriefCleared,
      shapeNormalized: repaired.shapeNormalized,
    },
  });
}

export async function POST(req: NextRequest) {
  const denied = guardApi(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const parsed = createBriefSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  const briefs = await readCollection<Brief>("briefs", SEED_BRIEFS);
  const brief: Brief = {
    id: uid("brief"),
    projectId: parsed.data.projectId,
    title: parsed.data.title,
    country: parsed.data.country,
    sector: parsed.data.sector,
    executiveSummary: parsed.data.executiveSummary,
    confidence: parsed.data.confidence ?? 50,
    recommendations: [],
    gaps: [],
    power: [],
    systems: [],
    narratives: [],
    riskLevel: "medium",
    createdAt: new Date().toISOString(),
    status: "draft",
  };
  briefs.unshift(brief);
  await writeCollection("briefs", briefs);
  return jsonOk({ brief }, { status: 201 });
}

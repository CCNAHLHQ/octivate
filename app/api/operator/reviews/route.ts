import { NextRequest } from "next/server";
import { guardApi, jsonCached, jsonError, jsonOk } from "@/lib/security/guard";
import { assertAllowedOrigin } from "@/lib/security/origin";
import { readCollection, writeCollection } from "@/lib/store/json-store";
import { SEED_BRIEFS, SEED_PROJECTS } from "@/lib/mock/seed";
import type { Brief, HumanReviewRecord, Project } from "@/lib/types";
import { listUsers } from "@/lib/auth/users";
import { appendAudit } from "@/lib/protocol/audit";
import { publishAccountingTick } from "@/lib/usage/usage-store";

export type PendingReviewRow = {
  id: string;
  title: string;
  projectId: string;
  projectName?: string;
  ownerId?: string;
  ownerEmail?: string;
  ownerName?: string;
  country?: string;
  sector?: string;
  createdAt?: string;
  reviewStatus: string;
};

async function buildPending(): Promise<PendingReviewRow[]> {
  const [briefs, projects, users] = await Promise.all([
    readCollection<Brief>("briefs", SEED_BRIEFS),
    readCollection<Project>("projects", SEED_PROJECTS),
    listUsers().catch(() => []),
  ]);

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const userById = new Map(users.map((u) => [u.id, u]));

  return briefs
    .filter((b) => b.reviewStatus === "pending_review")
    .map((b) => {
      const project = projectById.get(b.projectId);
      const owner = project?.ownerId ? userById.get(project.ownerId) : undefined;
      return {
        id: b.id,
        title: b.title,
        projectId: b.projectId,
        projectName: project?.name,
        ownerId: project?.ownerId,
        ownerEmail: owner?.email,
        ownerName:
          owner?.displayName || owner?.username || (project?.ownerId ? "Account" : "Unassigned seed"),
        country: b.country,
        sector: b.sector,
        createdAt: b.createdAt,
        reviewStatus: b.reviewStatus || "pending_review",
      };
    })
    .sort((a, b) => {
      const ae = a.ownerEmail || "";
      const be = b.ownerEmail || "";
      if (ae !== be) return ae.localeCompare(be);
      return Date.parse(b.createdAt || "") - Date.parse(a.createdAt || "");
    });
}

export async function GET(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;

  const pending = await buildPending();
  return jsonCached({ pending, count: pending.length });
}

/**
 * Clear reviews from the operator queue.
 * body.scope:
 *  - "stale" (default) — orphan/seed pending only (no project owner)
 *  - "all" — every pending_review brief + human-reviews pending rows
 */
export async function DELETE(req: NextRequest) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const originDenied = assertAllowedOrigin(req);
  if (originDenied) return originDenied;

  let scope: "stale" | "all" = "stale";
  try {
    const body = (await req.json()) as { scope?: string };
    if (body?.scope === "all") scope = "all";
  } catch {
    /* empty body = stale */
  }

  try {
    const briefs = await readCollection<Brief>("briefs", SEED_BRIEFS);
    const projects = await readCollection<Project>("projects", SEED_PROJECTS);
    const projectById = new Map(projects.map((p) => [p.id, p]));

    let cleared = 0;
    const clearedBriefIds = new Set<string>();
    const nextBriefs = briefs.map((b) => {
      if (b.reviewStatus !== "pending_review") return b;
      const project = projectById.get(b.projectId);
      if (scope === "stale" && project?.ownerId) return b;
      cleared += 1;
      clearedBriefIds.add(b.id);
      return {
        ...b,
        reviewStatus: "rejected" as const,
        status: "draft" as const,
      };
    });
    await writeCollection("briefs", nextBriefs);

    const reviews = await readCollection<HumanReviewRecord>("human-reviews", []);
    let reviewsCleared = 0;
    const nextReviews = reviews.map((r) => {
      const hit =
        scope === "all"
          ? r.review_status === "pending" || clearedBriefIds.has(r.briefId)
          : clearedBriefIds.has(r.briefId);
      if (!hit) return r;
      reviewsCleared += 1;
      return {
        ...r,
        review_status: "rejected" as const,
        final_approval: false,
        reviewer_actions: [
          ...(r.reviewer_actions || []),
          scope === "all" ? "operator_clear_all" : "operator_clear_stale",
        ],
      };
    });
    await writeCollection("human-reviews", nextReviews);

    await appendAudit({
      action: scope === "all" ? "ops_reviews_cleared_all" : "ops_reviews_cleared_stale",
      detail: `briefs=${cleared} · human-reviews=${reviewsCleared}`,
    });
    await publishAccountingTick("reviews_cleared", { scope, cleared, reviewsCleared });

    const pending = await buildPending();
    return jsonOk({
      cleared,
      reviewsCleared,
      scope,
      pending,
      count: pending.length,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Clear reviews failed", 500);
  }
}

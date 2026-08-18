import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { guardApi, jsonError, jsonOk } from "@/lib/security/guard";
import { readCollection, writeCollection } from "@/lib/store/json-store";
import { normalizeBrief } from "@/lib/briefs/normalize";
import { validateBriefForRelease } from "@/lib/briefs/release-validator";
import { briefReviewSchema } from "@/lib/validation/schemas";
import { SEED_BRIEFS } from "@/lib/mock/seed";
import { appendAudit } from "@/lib/protocol/audit";
import type { Brief, HumanReviewRecord } from "@/lib/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req);
  if (denied) return denied;
  const { id } = await params;

  const briefs = await readCollection<Brief>("briefs", SEED_BRIEFS);
  const brief = briefs.find((b) => b.id === id);
  if (!brief) return jsonError("Brief not found", 404);

  const reviews = await readCollection<HumanReviewRecord>("human-reviews", []);
  const review = reviews.find((r) => r.briefId === id) || null;

  return jsonOk({ brief: normalizeBrief(brief), review });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guardApi(req, { operator: true });
  if (denied) return denied;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON");
  }

  const parsed = briefReviewSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.message);

  const briefs = await readCollection<Brief>("briefs", SEED_BRIEFS);
  const idx = briefs.findIndex((b) => b.id === id);
  if (idx < 0) return jsonError("Brief not found", 404);

  const brief = briefs[idx];
  const reviews = await readCollection<HumanReviewRecord>("human-reviews", []);
  let review = reviews.find((r) => r.briefId === id);

  const now = new Date().toISOString();
  const actionMap = {
    approve: { review_status: "approved" as const, final_approval: true, reviewStatus: "approved" as const },
    reject: { review_status: "rejected" as const, final_approval: false, reviewStatus: "rejected" as const },
    needs_revision: { review_status: "needs_revision" as const, final_approval: false, reviewStatus: "draft" as const },
  };
  const mapped = actionMap[parsed.data.action];

  if (parsed.data.action === "approve") {
    // Sole source: facts persisted on this brief — never a global shared collection.
    const release = validateBriefForRelease(brief, {
      currentState: brief.currentStateFacts || [],
    });
    if (!release.ok) {
      await appendAudit({
        action: "release_blocked",
        briefId: id,
        sessionId: brief.sessionId,
        detail: release.hardBlocks.map((b) => b.code).join(","),
      });
      return NextResponse.json(
        {
          error: "Analytical release gate blocked finalisation",
          release,
        },
        { status: 422 }
      );
    }
  }

  if (review) {
    review.review_status = mapped.review_status;
    review.final_approval = mapped.final_approval;
    review.reviewer_notes = parsed.data.notes;
    review.reviewedAt = now;
    review.reviewer_actions = [...review.reviewer_actions, parsed.data.action];
  } else {
    review = {
      id: `review_${id}`,
      briefId: id,
      sessionId: brief.sessionId || "",
      review_status: mapped.review_status,
      reviewer_notes: parsed.data.notes,
      reviewer_actions: [parsed.data.action],
      final_approval: mapped.final_approval,
      createdAt: now,
      reviewedAt: now,
    };
    reviews.unshift(review);
  }

  brief.reviewStatus = mapped.reviewStatus;
  if (parsed.data.action === "approve") {
    brief.status = "final";
  } else if (parsed.data.action === "reject") {
    brief.status = "draft";
  }

  briefs[idx] = brief;
  await writeCollection("briefs", briefs);
  await writeCollection("human-reviews", reviews);

  await appendAudit({
    action: "human_review",
    briefId: id,
    sessionId: brief.sessionId,
    detail: parsed.data.action,
  });

  return jsonOk({ brief: normalizeBrief(brief), review });
}

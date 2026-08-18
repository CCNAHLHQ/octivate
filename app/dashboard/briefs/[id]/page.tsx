"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { BriefDocument } from "@/components/briefs/brief-document";
import { BriefExportBar } from "@/components/briefs/brief-export-bar";
import { briefBadgeTone } from "@/components/briefs/brief-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/progress";
import { apiFetch, ApiError, invalidateApiCache } from "@/lib/api-client";
import { notifyWorkspaceRefresh } from "@/lib/workspace-events";
import { toast } from "@/components/ui/toast";
import type { Brief, HumanReviewRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function BriefDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [review, setReview] = useState<HumanReviewRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

  async function load() {
    setLoading(true);
    setMissing(false);
    setLoadError(null);
    try {
      const data = await apiFetch<{ brief: Brief; review: HumanReviewRecord | null }>(
        `/api/briefs/${id}/review`,
        { skipCache: true }
      );
      setBrief(data.brief);
      setReview(data.review);
    } catch (err) {
      setBrief(null);
      setReview(null);
      if (err instanceof ApiError && err.status === 404) {
        setMissing(true);
      } else {
        setLoadError(err instanceof Error ? err.message : "Could not load brief");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function submitReview(action: "approve" | "reject" | "needs_revision") {
    setReviewBusy(true);
    try {
      const data = await apiFetch<{ brief: Brief; review: HumanReviewRecord }>(
        `/api/briefs/${id}/review`,
        { method: "POST", json: { action } }
      );
      setBrief(data.brief);
      setReview(data.review);
      invalidateApiCache("/api/briefs");
      notifyWorkspaceRefresh(["briefs", "overview"]);
      const label = action === "approve" ? "approved" : action;
      toast.success(`Brief ${label}`);
      if (action === "approve") {
        void import("@/lib/alerts/notify").then(({ octivateAlert }) =>
          octivateAlert({
            kind: "success",
            title: "Brief approved",
            body: data.brief.title,
            href: `/dashboard/briefs/${data.brief.id}`,
          })
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed");
    } finally {
      setReviewBusy(false);
    }
  }

  return (
      <div className="mx-auto max-w-[1040px] space-y-4 p-4 sm:p-6">
        <Link href="/dashboard/briefs" className="text-xs text-teal">
          ← Back to briefs
        </Link>
        {loading ? (
          <Skeleton className="h-64" />
        ) : missing ? (
          <Card className="space-y-3 p-6">
            <h1 className="font-display text-2xl font-bold tracking-tight">Brief not found</h1>
            <p className="text-sm text-mist">
              This result link is no longer valid. The brief may have been removed or the session
              still points at an old id.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/briefs">
                <Button size="sm">Browse briefs</Button>
              </Link>
              <Link href="/dashboard/projects">
                <Button size="sm" variant="ghost">
                  Projects
                </Button>
              </Link>
            </div>
          </Card>
        ) : loadError ? (
          <Card className="space-y-3 p-6">
            <h1 className="font-display text-xl font-bold">Could not load brief</h1>
            <p className="text-sm text-coral">{loadError}</p>
            <Button size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </Card>
        ) : !brief ? (
          <Card className="p-6 text-sm text-mist">No brief data available.</Card>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <header className="brief-page-header">
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  {brief.title}
                </h1>
                <p className="mt-1 font-mono text-xs text-faint">
                  {brief.country} · {brief.sector} · {new Date(brief.createdAt).toLocaleString()}
                  {brief.confidence != null ? ` · ${Math.round(brief.confidence)}% confidence` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={cn("ws-brief-pill", `is-${briefBadgeTone("risk", brief.riskLevel)}`)}>
                    {brief.riskLevel}
                  </span>
                  {brief.reviewStatus ? (
                    <span
                      className={cn(
                        "ws-brief-pill",
                        `is-${briefBadgeTone("review", brief.reviewStatus)}`
                      )}
                    >
                      {brief.reviewStatus.replace(/_/g, " ")}
                    </span>
                  ) : (
                    <span
                      className={cn("ws-brief-pill", `is-${briefBadgeTone("status", brief.status)}`)}
                    >
                      {brief.status}
                    </span>
                  )}
                </div>
                {brief.projectId ? (
                  <Link
                    href={`/dashboard/projects/${brief.projectId}`}
                    className="mt-2 inline-block text-xs text-[var(--violet)] hover:underline"
                  >
                    Open linked project
                  </Link>
                ) : null}
              </div>
            </header>

            <BriefExportBar briefId={brief.id} />

            {brief.reviewStatus === "pending_review" && (
              <Card className="border-amber/30 bg-amber/5 p-4">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-amber">
                  Pending operator review
                </h2>
                <p className="mt-1 text-sm text-mist">
                  Doctrine briefs require human approval before final delivery.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" disabled={reviewBusy} onClick={() => void submitReview("approve")}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={reviewBusy}
                    onClick={() => void submitReview("needs_revision")}
                  >
                    Needs revision
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={reviewBusy}
                    onClick={() => void submitReview("reject")}
                  >
                    Reject
                  </Button>
                </div>
              </Card>
            )}

            <BriefDocument
              brief={brief}
              footer={
                review ? (
                  <section className="brief-panel">
                    <h2 className="brief-panel-label">Review record</h2>
                    <div className="brief-panel-body">
                      <p className="text-sm text-mist">
                        Status: {review.review_status}
                        {review.reviewedAt
                          ? ` · ${new Date(review.reviewedAt).toLocaleString()}`
                          : ""}
                      </p>
                    </div>
                  </section>
                ) : null
              }
            />
          </motion.div>
        )}
      </div>
  );
}

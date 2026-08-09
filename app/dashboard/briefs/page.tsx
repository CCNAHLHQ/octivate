"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, FileText, Layers } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { BriefCard, BriefCardSkeleton } from "@/components/briefs/brief-card";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { WorkspaceKpiStrip } from "@/components/workspace/workspace-kpi-strip";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { LoadingBlur } from "@/components/ui/loading-blur";
import { useT } from "@/components/i18n/locale-provider";
import { apiFetch } from "@/lib/api-client";
import { useWorkspaceRefresh } from "@/lib/hooks/use-workspace-refresh";
import type { Brief } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Two rows of two cards — keeps the list short without a long scroll. */
const PAGE_SIZE = 4;

export default function BriefsPage() {
  const t = useT();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setInitialLoading(true);
    try {
      const data = await apiFetch<{ briefs: Brief[] }>("/api/briefs", { skipCache: true });
      setBriefs(data.briefs);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useWorkspaceRefresh(() => load(true), ["briefs"]);

  const kpis = useMemo(() => {
    const pending = briefs.filter((b) => b.reviewStatus === "pending_review").length;
    const approved = briefs.filter(
      (b) => b.reviewStatus === "approved" || b.status === "final"
    ).length;
    const depths = new Set(briefs.map((b) => b.analysisDepth || "standard")).size;
    return [
      {
        label: t("ws.overview.briefs"),
        value: briefs.length,
        icon: FileText,
        tone: "violet" as const,
      },
      {
        label: t("ws.briefs.pendingReview"),
        value: pending,
        icon: Clock3,
        tone: "default" as const,
      },
      {
        label: t("ws.briefs.approved"),
        value: approved,
        icon: CheckCircle2,
        tone: "violet" as const,
      },
      {
        label: t("ws.briefs.depthModes"),
        value: depths,
        icon: Layers,
        tone: "default" as const,
      },
    ];
  }, [briefs, t]);

  const pageCount = Math.max(1, Math.ceil(briefs.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => briefs.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [briefs, safePage]
  );
  const rangeStart = briefs.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(briefs.length, (safePage + 1) * PAGE_SIZE);
  const showPager = briefs.length > 0;

  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  function goToPage(next: number) {
    const clamped = Math.max(0, Math.min(pageCount - 1, next));
    setPage(clamped);
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /** Compact page index list so long catalogs stay usable. */
  const pageButtons = useMemo(() => {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i);
    const set = new Set<number>([0, pageCount - 1, safePage, safePage - 1, safePage + 1]);
    if (safePage <= 2) [0, 1, 2, 3].forEach((i) => set.add(i));
    if (safePage >= pageCount - 3)
      [pageCount - 1, pageCount - 2, pageCount - 3, pageCount - 4].forEach((i) => set.add(i));
    return [...set].filter((i) => i >= 0 && i < pageCount).sort((a, b) => a - b);
  }, [pageCount, safePage]);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-5 p-4 sm:p-6">
        <WorkspacePageHeader
          eyebrow={t("ws.section.intelligence")}
          title={t("ws.briefs.title")}
          description={t("ws.briefs.lede")}
        />

        {!initialLoading ? <WorkspaceKpiStrip items={kpis} /> : null}

        {initialLoading ? (
          <div className="ws-brief-grid">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <BriefCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <LoadingBlur active={refreshing}>
            {briefs.length === 0 ? (
              <WorkspaceEmptyState
                icon={FileText}
                title={t("ws.briefs.empty")}
                description={t("ws.briefs.emptyHint")}
                action={
                  <Link href="/dashboard/projects" className="btn btn-primary btn-sm">
                    {t("ws.briefs.openProjects")}
                  </Link>
                }
              />
            ) : (
              <>
                <div ref={gridRef} className="ws-brief-grid">
                  {pageRows.map((b) => (
                    <BriefCard key={b.id} brief={b} />
                  ))}
                </div>

                {showPager ? (
                  <div
                    className="ws-pager"
                    role="navigation"
                    aria-label={t("ws.briefs.pagination")}
                  >
                    <p className="ws-pager-meta">
                      {t("ws.briefs.showing")
                        .replace("{from}", String(rangeStart))
                        .replace("{to}", String(rangeEnd))
                        .replace("{total}", String(briefs.length))}
                      {pageCount > 1 ? ` · Page ${safePage + 1} of ${pageCount}` : null}
                    </p>
                    <div className="ws-pager-controls">
                      <button
                        type="button"
                        className="ws-pager-btn"
                        disabled={safePage <= 0}
                        onClick={() => goToPage(safePage - 1)}
                        aria-label={t("ws.briefs.prevPage")}
                      >
                        Prev
                      </button>
                      {pageButtons.map((i, idx) => {
                        const prev = pageButtons[idx - 1];
                        const gap = prev != null && i - prev > 1;
                        return (
                          <span key={i} className="inline-flex items-center gap-1">
                            {gap ? <span className="ws-pager-page">…</span> : null}
                            <button
                              type="button"
                              className={cn("ws-pager-btn", i === safePage && "is-active")}
                              aria-label={`Page ${i + 1}`}
                              aria-current={i === safePage ? "page" : undefined}
                              onClick={() => goToPage(i)}
                            >
                              {i + 1}
                            </button>
                          </span>
                        );
                      })}
                      <button
                        type="button"
                        className="ws-pager-btn"
                        disabled={safePage >= pageCount - 1}
                        onClick={() => goToPage(safePage + 1)}
                        aria-label={t("ws.briefs.nextPage")}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </LoadingBlur>
        )}
      </div>
    </AppShell>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Play, RefreshCw, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "@/components/ui/toast";
import { toastActionError } from "@/lib/ui/action-feedback";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { notifyWorkspaceRefresh } from "@/lib/workspace-events";
import type { TopicTemplate } from "@/lib/topics/templates";
import type { AgentSession, Project, Trend } from "@/lib/types";
import { cn } from "@/lib/utils";

type TopicsResponse = {
  templates: TopicTemplate[];
  hotTopics: Trend[];
};

const HEAT_TONE: Record<TopicTemplate["heat"], "coral" | "amber" | "teal"> = {
  hot: "coral",
  rising: "amber",
  watch: "teal",
};

export function TopicStarters({
  projectId,
  onApplyQuestion,
  onSessionStarted,
  compact = false,
  variant = "board",
  pipelineBusy = false,
  onRefreshReady,
}: {
  projectId?: string;
  onApplyQuestion?: (question: string, depth: TopicTemplate["suggestedDepth"]) => void;
  onSessionStarted?: (session: AgentSession) => void;
  compact?: boolean;
  /** strip = project page chips; board = overview cards */
  variant?: "strip" | "board";
  pipelineBusy?: boolean;
  /** Expose scrape for command strip */
  onRefreshReady?: (refresh: () => void) => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<TopicsResponse | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch<TopicsResponse>("/api/topics", { skipCache: true });
    setData(res);
  }, []);

  useEffect(() => {
    void load().catch(() => {
      /* optional */
    });
  }, [load]);

  const scrape = useCallback(async () => {
    setScraping(true);
    try {
      const res = await apiFetch<{
        feedsOk: number;
        trendsAdded: number;
        usedFallback: boolean;
      }>("/api/topics/scrape", { method: "POST" });
      await load();
      notifyWorkspaceRefresh(["overview"]);
      toast.success(
        res.usedFallback
          ? `Refreshed curated Caribbean signals (${res.trendsAdded})`
          : `Scraped ${res.feedsOk} feed(s) · ${res.trendsAdded} topics`
      );
    } catch (err) {
      toastActionError(err);
    } finally {
      setScraping(false);
    }
  }, [load]);

  useEffect(() => {
    onRefreshReady?.(() => void scrape());
  }, [onRefreshReady, scrape]);

  async function runTemplate(t: TopicTemplate, mode: "apply" | "launch") {
    if (mode === "apply" && onApplyQuestion && projectId) {
      onApplyQuestion(t.question, t.suggestedDepth);
      toast.success("Question loaded — click Run agent workflow");
      return;
    }

    if (pipelineBusy) {
      toast.warning("A workflow is already running.");
      return;
    }

    setBusyId(t.id);
    try {
      const res = await apiFetch<{
        project: Project;
        session: AgentSession | null;
        started: boolean;
        error?: string;
      }>(`/api/topics/${t.id}/start`, {
        method: "POST",
        json: { run: true, analysisDepth: t.suggestedDepth },
      });
      invalidateApiCache("/api/projects");
      notifyWorkspaceRefresh(["projects", "overview"]);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.started ? "Pipeline started" : "Project ready");
        void import("@/lib/alerts/notify").then(({ octivateAlert }) =>
          octivateAlert({
            kind: "info",
            title: res.started ? "Pipeline started" : "Project ready",
            body: res.started
              ? "The agent workflow is running."
              : "Your project is ready to continue.",
            href: `/dashboard/projects/${res.project.id}`,
          })
        );
      }
      if (res.session && onSessionStarted && res.project.id === projectId) {
        onSessionStarted(res.session);
      }
      if (res.project.id !== projectId) {
        router.push(`/dashboard/projects/${res.project.id}`);
      }
    } catch (err) {
      toastActionError(err);
    } finally {
      setBusyId(null);
    }
  }

  if (!data) {
    return (
      <div className={variant === "strip" ? "ws-topic-strip" : "ws-topic-board"}>
        <p className="text-sm text-mist">Loading topic templates…</p>
      </div>
    );
  }

  const templates = compact || variant === "strip" ? data.templates.slice(0, 6) : data.templates;

  if (variant === "strip") {
    const starters = templates.slice(0, 5);
    return (
      <div className="ws-topic-strip is-compact">
        <div className="ws-topic-strip-head">
          <span className="ws-topic-strip-title">
            <Sparkles className="h-3 w-3 text-violet" aria-hidden />
            Starters
          </span>
          <span className="ws-topic-strip-hint">Tap to load · play to run</span>
        </div>

        <div className="ws-topic-chip-row" role="list">
          {starters.map((t) => (
            <div key={t.id} className="ws-topic-chip is-compact" role="listitem">
              <button
                type="button"
                className="ws-topic-chip-main"
                disabled={!!busyId || pipelineBusy || !onApplyQuestion}
                title={t.summary || t.name}
                onClick={() => void runTemplate(t, "apply")}
              >
                <span className={cn("ws-topic-heat", `is-${t.heat}`)} aria-hidden />
                <span className="ws-topic-chip-name">{t.name}</span>
              </button>
              <button
                type="button"
                className="ws-topic-chip-run"
                disabled={busyId === t.id || pipelineBusy}
                title={`Run “${t.name}”`}
                aria-label={`Run ${t.name}`}
                onClick={() => void runTemplate(t, "launch")}
              >
                <Play className="h-3 w-3" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ws-topic-board">
      <div className="ws-topic-head">
        <div>
          <h2 className="ws-section-title">
            <Sparkles className="h-4 w-4 text-violet" aria-hidden />
            Topic starters
          </h2>
          <p className="ws-section-sub">
            Curated Caribbean decision topics — one click loads a real question and can run the
            pipeline through live API infrastructure.
          </p>
        </div>
        <Button size="sm" variant="ghost" disabled={scraping} onClick={() => void scrape()}>
          <RefreshCw className={cn("h-3.5 w-3.5", scraping && "animate-spin")} />
          {scraping ? "Scraping…" : "Refresh signals"}
        </Button>
      </div>

      {data.hotTopics.length > 0 && (
        <div className="ws-hot-strip" aria-label="Hottest Caribbean signals">
          {data.hotTopics.slice(0, 5).map((t) => (
            <span key={t.id} className="ws-hot-chip" title={t.summary}>
              <Flame className="h-3 w-3" aria-hidden />
              <span className="truncate">{t.title}</span>
            </span>
          ))}
        </div>
      )}

      <div className="ws-topic-grid">
        {templates.map((t) => (
          <article key={t.id} className="ws-topic-card">
            <div className="ws-topic-card-top">
              <StatusBadge tone={HEAT_TONE[t.heat]}>{t.heat}</StatusBadge>
              <span className="ws-topic-meta">
                {t.country} · {t.sector}
              </span>
            </div>
            <h3 className="ws-topic-name">{t.name}</h3>
            <p className="ws-topic-summary">{t.summary}</p>
            <div className="ws-topic-tags">
              {t.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="ws-topic-tag">
                  {tag}
                </span>
              ))}
            </div>
            <div className="ws-topic-actions">
              {onApplyQuestion && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!!busyId || pipelineBusy}
                  onClick={() => void runTemplate(t, "apply")}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Use here
                </Button>
              )}
              <Button
                size="sm"
                disabled={busyId === t.id || pipelineBusy}
                onClick={() => void runTemplate(t, "launch")}
              >
                <Play className="h-3.5 w-3.5" />
                {busyId === t.id ? "Starting…" : "Run now"}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

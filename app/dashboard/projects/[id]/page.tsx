"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  FileText,
  GripVertical,
  LayoutGrid,
  Pencil,
  Radio,
  RotateCw,
} from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { AgentPipelineProgress } from "@/components/dashboard/agent-pipeline";
import { DocumentDropzone } from "@/components/dashboard/document-dropzone";
import { DocumentLibrary } from "@/components/dashboard/document-library";
import { QuickExportButtons } from "@/components/dashboard/quick-export-buttons";
import { ProjectInsights } from "@/components/dashboard/project-insights";
import { QuestionVoiceField } from "@/components/dashboard/question-voice-field";
import {
  CountrySelect,
  SectorSelect,
} from "@/components/projects/country-sector-fields";
import { BrandBackdrop } from "@/components/brand/brand-backdrop";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingBlur } from "@/components/ui/loading-blur";
import { ConfettiBurst } from "@/components/ui/confetti-burst";
import { toast, TOAST_ERROR_DURATION_MS } from "@/components/ui/toast";
import { useT } from "@/components/i18n/locale-provider";
import { apiFetch, invalidateApiCache, getClientApiKey } from "@/lib/api-client";
import { pipelineFailureHint, toastActionError } from "@/lib/ui/action-feedback";
import { isStaleRunning } from "@/lib/agents/session-stale";
import { usePipelineMode } from "@/lib/hooks/use-pipeline-mode";
import { useWorkspaceRefresh } from "@/lib/hooks/use-workspace-refresh";
import { useModularLayout, type LayoutCol } from "@/lib/hooks/use-modular-layout";
import { notifyWorkspaceRefresh } from "@/lib/workspace-events";
import type { AgentSession, AnalysisDepth, Monitor, Project } from "@/lib/types";
import { cn } from "@/lib/utils";

function ModuleShell({
  id,
  title,
  col,
  row,
  dragId,
  overCell,
  onDragStart,
  onDragEnd,
  onDragOverCell,
  onDropCell,
  children,
}: {
  id: string;
  title: string;
  col: LayoutCol;
  row: number;
  dragId: string | null;
  overCell: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOverCell: (col: LayoutCol, row: number) => void;
  onDropCell: (col: LayoutCol, row: number) => void;
  children: ReactNode;
}) {
  const cell = `${col}:${row}`;
  const isDrop = overCell === cell && dragId !== null && dragId !== id;
  return (
    <div
      className={cn(
        "ws-module",
        isDrop && "is-drop-target",
        dragId === id && "is-dragging"
      )}
      style={{ gridColumn: col + 1, gridRow: row + 1 }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOverCell(col, row);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropCell(col, row);
      }}
    >
      {/* Drag only from the chrome handle — whole-card drag stole clicks from mic/inputs */}
      <div
        className="ws-module-chrome"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", id);
          onDragStart(id);
        }}
        onDragEnd={onDragEnd}
      >
        <GripVertical className="h-3.5 w-3.5 text-faint" aria-hidden />
        <span>{title}</span>
        <span className="ws-module-cell-tag">
          R{row + 1} · C{col + 1}
        </span>
      </div>
      <Card className="ws-module-body p-4">{children}</Card>
    </div>
  );
}

function EmptyGridCell({
  col,
  row,
  dragId,
  overCell,
  onDragOverCell,
  onDropCell,
}: {
  col: LayoutCol;
  row: number;
  dragId: string | null;
  overCell: string | null;
  onDragOverCell: (col: LayoutCol, row: number) => void;
  onDropCell: (col: LayoutCol, row: number) => void;
}) {
  const cell = `${col}:${row}`;
  const active = !!dragId && overCell === cell;
  return (
    <div
      className={cn("ws-mod-empty", active && "is-active", dragId && "is-dragging-board")}
      style={{ gridColumn: col + 1, gridRow: row + 1 }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOverCell(col, row);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropCell(col, row);
      }}
      aria-label={`Empty grid cell row ${row + 1}, column ${col + 1}`}
    >
      <span className="ws-mod-empty-label">
        Drop · R{row + 1} C{col + 1}
      </span>
    </div>
  );
}

function sessionFailMessage(session: AgentSession | null): string | null {
  if (!session || session.status !== "failed") return null;
  if (session.error) return session.error;
  const failed = [...session.stages].reverse().find((s) => s.status === "failed" && s.message);
  return failed?.message || null;
}

export default function ProjectDetailPage() {
  const t = useT();
  const params = useParams();
  const id = String(params.id);

  const [project, setProject] = useState<Project | null>(null);
  const [linkedMonitors, setLinkedMonitors] = useState<Monitor[]>([]);
  const [question, setQuestion] = useState("");
  const [analysisDepth, setAnalysisDepth] = useState<AnalysisDepth>("standard");
  const [usePaidModel, setUsePaidModel] = useState(false);
  const [session, setSession] = useState<AgentSession | null>(null);
  /** Known brief ids for this project — keeps View result wired only to real briefs. */
  const [projectBriefIds, setProjectBriefIds] = useState<string[]>([]);
  /** Latest brief for this project — keeps View result / export wired for archive runs. */
  const [projectBriefId, setProjectBriefId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editSector, setEditSector] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confettiKey, setConfettiKey] = useState<string | null>(null);
  const { mode: pipelineMode, isInteractive, isLive } = usePipelineMode();
  const layout = useModularLayout(id);

  const sessionStale = !!session && isStaleRunning(session);
  const sessionActivelyRunning = session?.status === "running" && !sessionStale;
  const pipelineBusy = submitting || sessionActivelyRunning;
  const canRerun =
    !!session &&
    (session.status === "completed" ||
      session.status === "failed" ||
      sessionStale);

  const loadProject = useCallback(
    async (soft = false) => {
      if (soft) setRefreshing(true);
      try {
        const [proj, monitors, sessionsRes, briefsRes] = await Promise.all([
          apiFetch<{ project: Project }>(`/api/projects/${id}`, { skipCache: true }),
          apiFetch<{ monitors: Monitor[] }>("/api/monitors", { skipCache: true }),
          apiFetch<{ sessions: AgentSession[] }>(`/api/agents/sessions?projectId=${id}`, {
            skipCache: true,
          }).catch(() => ({ sessions: [] as AgentSession[] })),
          apiFetch<{ briefs: { id: string }[]; latestBriefId: string | null }>(
            `/api/briefs?projectId=${id}`,
            { skipCache: true }
          ).catch(() => ({ briefs: [], latestBriefId: null as string | null })),
        ]);
        setProject(proj.project);
        setEditName(proj.project.name);
        setEditCountry(proj.project.country);
        setEditSector(proj.project.sector);
        if (proj.project.question) setQuestion(proj.project.question);
        setLinkedMonitors(monitors.monitors.filter((m) => m.projectId === id));
        setProjectBriefId(briefsRes.latestBriefId);
        setProjectBriefIds((briefsRes.briefs || []).map((b) => b.id));

        const prior = sessionsRes.sessions;
        const runningFresh = prior.find((s) => s.status === "running" && !isStaleRunning(s));
        const completedWithBrief = prior.find((s) => s.status === "completed" && s.briefId);
        const latest = prior[0] ?? null;
        setSession((cur) => {
          // Keep a live in-flight session, but never cling to a stale/abandoned one.
          if (cur?.status === "running" && !isStaleRunning(cur)) return cur;
          return runningFresh ?? completedWithBrief ?? latest ?? cur;
        });
      } finally {
        if (soft) setRefreshing(false);
      }
    },
    [id]
  );

  const onPipelineDone = useCallback(
    async (completed: AgentSession) => {
      setRefreshing(true);
      try {
        invalidateApiCache("/api/briefs");
        invalidateApiCache("/api/projects");
        notifyWorkspaceRefresh(["briefs", "projects", "overview"]);
        await loadProject(true);
        if (completed.status === "completed" && completed.briefId) {
          setConfettiKey(completed.briefId);
          window.setTimeout(() => setConfettiKey(null), 1800);
          toast.success(t("ws.project.briefReady"));
          void import("@/lib/alerts/notify").then(({ octivateAlert }) =>
            octivateAlert({
              kind: "success",
              title: t("ws.project.briefReady"),
              body: t("ws.project.workflowDone"),
              href: `/dashboard/briefs/${completed.briefId}`,
            })
          );
        } else if (completed.status === "failed") {
          if (completed.errorDetail?.code === "superseded") return;
          const code = completed.errorDetail?.code;
          const model = completed.modelUsed;
          const base =
            completed.error ||
            t("ws.project.workflowFailed");
          const detail = [code && `code: ${code}`, model && `model: ${model}`]
            .filter(Boolean)
            .join(" · ");
          toast.error(detail ? `${base} (${detail})` : base, {
            durationMs: TOAST_ERROR_DURATION_MS,
          });
          setError(detail ? `${base} (${detail})` : base);
        }
      } finally {
        setRefreshing(false);
      }
    },
    [loadProject]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await loadProject();
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : t("ws.project.loadFailed"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadProject]);

  useWorkspaceRefresh(() => loadProject(true), ["projects", "monitors"]);

  const pollSession = useCallback(async (sessionId: string) => {
    const data = await apiFetch<{ session: AgentSession }>(`/api/agents/sessions/${sessionId}`);
    setSession(data.session);
    return data.session;
  }, []);

  useEffect(() => {
    if (!session || session.status === "completed" || session.status === "failed") return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const ctrl = new AbortController();

    async function runStream() {
      try {
        const res = await fetch(`/api/agents/sessions/${session!.id}/stream`, {
          headers: { Authorization: `Bearer ${getClientApiKey()}` },
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!res.ok || !res.body) throw new Error("stream unavailable");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const chunks = buf.split("\n\n");
          buf = chunks.pop() || "";
          for (const chunk of chunks) {
            const line = chunk.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            try {
              const payload = JSON.parse(line.slice(6)) as {
                type: string;
                session: AgentSession;
              };
              if (payload.session) setSession(payload.session);
              if (payload.type === "done") {
                ctrl.abort();
                if (
                  payload.session?.status === "completed" ||
                  payload.session?.status === "failed"
                ) {
                  void onPipelineDone(payload.session);
                }
              }
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        if (cancelled || pollTimer) return;
        pollTimer = setInterval(async () => {
          try {
            const s = await pollSession(session!.id);
            if (s.status === "completed" || s.status === "failed") {
              if (pollTimer) clearInterval(pollTimer);
              void onPipelineDone(s);
            }
          } catch {
            if (pollTimer) clearInterval(pollTimer);
          }
        }, 1200);
      }
    }

    void runStream();

    return () => {
      cancelled = true;
      ctrl.abort();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [session?.id, session?.status, pollSession, onPipelineDone]);

  async function startWorkflow(opts: { force?: boolean } = {}) {
    const force = opts.force === true || sessionStale;
    if (pipelineBusy && !force) {
      toast.warning(t("ws.project.alreadyRunning"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const data = await apiFetch<{ session: AgentSession }>(`/api/projects/${id}/questions`, {
        method: "POST",
        json: { question, analysisDepth, force, usePaidModel },
      });
      setSession(data.session);
      setProject((prev) => (prev ? { ...prev, question } : prev));
      notifyWorkspaceRefresh(["projects", "overview"]);
      if (opts.force) {
        toast.info(t("ws.project.workflowStarted"), { durationMs: 6000 });
      }
    } catch (err) {
      const c = toastActionError(err);
      setError(c.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    await startWorkflow();
  }

  async function rerun() {
    if (isArchived) return;
    if (!question || question.trim().length < 10) {
      toast.error(t("ws.project.needQuestion"), {
        durationMs: TOAST_ERROR_DURATION_MS,
      });
      return;
    }
    toast.info(
      sessionStale
        ? t("ws.project.stuckRerun")
        : t("ws.project.rerunningToast")
    );
    await startWorkflow({ force: true });
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    setSavingSettings(true);
    try {
      const data = await apiFetch<{ project: Project }>(`/api/projects/${id}`, {
        method: "PATCH",
        json: { name: editName, country: editCountry, sector: editSector },
      });
      setProject(data.project);
      invalidateApiCache("/api/projects");
      notifyWorkspaceRefresh(["projects", "overview"]);
      toast.success(t("ws.project.updated"));
    } catch (err) {
      toastActionError(err);
    } finally {
      setSavingSettings(false);
    }
  }

  async function archiveProject() {
    if (!project || project.status === "archived") return;
    setSavingSettings(true);
    try {
      const data = await apiFetch<{ project: Project }>(`/api/projects/${id}`, {
        method: "PATCH",
        json: { status: "archived" },
      });
      setProject(data.project);
      invalidateApiCache("/api/projects");
      notifyWorkspaceRefresh(["projects", "overview"]);
      toast.success(t("ws.project.archived"));
    } catch (err) {
      toastActionError(err);
    } finally {
      setSavingSettings(false);
    }
  }

  async function restoreProject() {
    if (!project || project.status === "active") return;
    setSavingSettings(true);
    try {
      const data = await apiFetch<{ project: Project }>(`/api/projects/${id}`, {
        method: "PATCH",
        json: { status: "active" },
      });
      setProject(data.project);
      invalidateApiCache("/api/projects");
      notifyWorkspaceRefresh(["projects", "overview"]);
      toast.success(t("ws.project.restored"));
    } catch (err) {
      toastActionError(err);
    } finally {
      setSavingSettings(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="p-6">
          <Skeleton className="h-48" />
        </div>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell>
        <div className="p-6 text-coral">{error || t("ws.project.notFound")}</div>
      </AppShell>
    );
  }

  const isArchived = project.status === "archived";
  const failHint = pipelineFailureHint(sessionFailMessage(session));
  const linkedBriefId =
    (session?.briefId && projectBriefIds.includes(session.briefId) && session.briefId) ||
    (projectBriefId && projectBriefIds.includes(projectBriefId) && projectBriefId) ||
    null;

  const moduleBody: Record<string, ReactNode> = {
    question: (
      <div data-tour="project-question">
        <h2 className="ws-section-title mb-3">{t("ws.project.askStrategic")}</h2>
        <form onSubmit={ask} className="space-y-3">
          <QuestionVoiceField
            value={question}
            onChange={setQuestion}
            disabled={isArchived}
          />
          {isLive && (
            <div>
              <label className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-mist">
                Analysis depth
              </label>
              <Select
                className="is-teal"
                value={analysisDepth}
                onChange={(e) => setAnalysisDepth(e.target.value as AnalysisDepth)}
                disabled={isArchived || pipelineBusy}
              >
                <option value="rapid">{t("ws.project.depth.rapid")}</option>
                <option value="standard">{t("ws.project.depth.standard")}</option>
                <option value="deep_dive">{t("ws.project.depth.deep")}</option>
              </Select>
              <p className="mt-1.5 text-xs text-mist">
                {analysisDepth === "rapid"
                  ? t("ws.project.depth.rapidHint")
                  : analysisDepth === "deep_dive"
                    ? t("ws.project.depth.deepHint")
                    : t("ws.project.depth.standardHint")}
              </p>
              <label className="mt-3 flex items-start gap-2 text-xs text-mist">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={usePaidModel}
                  disabled={isArchived || pipelineBusy}
                  onChange={(e) => setUsePaidModel(e.target.checked)}
                />
                <span>
                  Use paid model when operator allows premium (default remains free Nemotron).
                </span>
              </label>
            </div>
          )}
          <Button type="submit" size="sm" disabled={pipelineBusy || isArchived} data-tour="run-workflow">
            {pipelineBusy ? t("ws.project.agentsRunning") : t("ws.project.run")}
          </Button>
          {isArchived && (
            <p className="text-xs text-mist">{t("ws.project.restoreForAgents")}</p>
          )}
          {error && <p className="text-xs text-coral">{error}</p>}
        </form>
      </div>
    ),
    documents: (
      <>
        <h2 className="ws-section-title mb-3">{t("ws.project.module.documents")}</h2>
        <DocumentLibrary
          projectId={id}
          projectName={project.name}
          country={project.country}
          sector={project.sector}
          documents={project.documents}
          disabled={isArchived || pipelineBusy}
          onChanged={(p) => setProject(p)}
        />
        <DocumentDropzone
          projectId={id}
          disabled={isArchived}
          onUploaded={(p) => setProject(p)}
        />
        {isArchived && (
          <p className="mt-2 text-xs text-mist">{t("ws.project.restoreForDocs")}</p>
        )}
      </>
    ),
    monitors:
      linkedMonitors.length > 0 ? (
        <>
          <h2 className="ws-section-title mb-3">{t("ws.project.linkedMonitors")}</h2>
          <div className="ws-linked-list">
            {linkedMonitors.map((m) => (
              <Link key={m.id} href={`/dashboard/monitors/${m.id}`} className="ws-linked-item">
                <span className="inline-flex items-center gap-2">
                  <Radio className="h-3.5 w-3.5 text-teal" aria-hidden />
                  {m.name}
                </span>
                <StatusBadge tone={m.status === "active" ? "teal" : "amber"}>{m.status}</StatusBadge>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-mist">{t("ws.project.noMonitors")}</p>
      ),
    pipeline: (
      <>
        <AgentPipelineProgress
          session={session}
          documentCount={project.documents.length}
          idleHint={`Standing by for ${project.country} · ${project.sector}. Run the workflow when ready.`}
        />
        {(linkedBriefId || canRerun) && (
          <div className="mt-4 flex flex-col gap-2">
            {canRerun && (
              <Button
                size="sm"
                variant="ghost"
                className="w-full"
                disabled={submitting || isArchived}
                onClick={() => void rerun()}
              >
                <RotateCw className="h-3.5 w-3.5" />
                {submitting
                  ? t("ws.project.rerunning")
                  : sessionStale
                    ? t("ws.project.forceRerun")
                    : t("ws.project.rerun")}
              </Button>
            )}
            {sessionStale && (
              <p className="text-xs text-amber">
                This run stopped reporting progress. Force rerun to replace it.
              </p>
            )}
            {session?.status === "failed" && !sessionStale && (
              <p className="text-xs text-coral">{failHint}</p>
            )}
          </div>
        )}
        {linkedBriefId && !pipelineBusy ? (
          <div className="mt-3 border-t border-[var(--line)] pt-3">
            <QuickExportButtons briefId={linkedBriefId} ready={!pipelineBusy} />
          </div>
        ) : null}
      </>
    ),
    insights: (
      <ProjectInsights
        session={session}
        documentCount={project.documents.length}
        monitorCount={linkedMonitors.length}
      />
    ),
  };

  const titles: Record<string, string> = {
    question: t("ws.project.module.question"),
    documents: t("ws.project.module.documents"),
    monitors: t("ws.project.module.monitors"),
    pipeline: t("ws.project.module.agent"),
    insights: t("ws.project.module.pulse"),
  };

  return (
    <AppShell>
      <ConfettiBurst fireKey={confettiKey} />
      <LoadingBlur active={refreshing} className="mx-auto max-w-[1280px]">
        <div className="ws-project-surface relative space-y-4 p-4 sm:p-6">
          <BrandBackdrop marquee />

          <div className="ws-project-hero is-compact relative z-[1]">
            <div className="ws-project-hero-top">
              <Link href="/dashboard/projects" className="ws-breadcrumb">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Projects
              </Link>
              <button
                type="button"
                className="ws-icon-btn"
                onClick={() => setSettingsOpen((o) => !o)}
                aria-expanded={settingsOpen}
                aria-label={
                  settingsOpen ? t("ws.project.closeSettings") : t("ws.project.edit")
                }
                title={t("ws.project.edit")}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>

            <div className="ws-project-hero-main">
              <h1 className="ws-project-title">{project.name}</h1>
              <div className="ws-project-meta">
                <span>
                  {project.country} · {project.sector}
                </span>
                <StatusBadge tone={isInteractive ? "teal" : "amber"}>
                  {isInteractive ? "Live" : t("ws.project.liveAwaiting")}
                </StatusBadge>
                {session?.status === "completed" && (
                  <StatusBadge tone="teal">Saved</StatusBadge>
                )}
                {isArchived && <StatusBadge tone="amber">Archived</StatusBadge>}
              </div>
            </div>

            {settingsOpen && (
              <div className="ws-create-panel mt-2">
                <div className="ws-create-panel-body">
                  <form onSubmit={saveSettings} className="ws-settings-grid">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      placeholder={t("ws.project.name")}
                    />
                    <CountrySelect
                      value={editCountry}
                      onChange={setEditCountry}
                      required
                      disabled={savingSettings}
                    />
                    <SectorSelect
                      value={editSector}
                      onChange={setEditSector}
                      required
                      disabled={savingSettings}
                    />
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={savingSettings || !editName.trim() || !editCountry || !editSector}
                      >
                        {savingSettings ? t("ws.project.saving") : t("ws.project.save")}
                      </Button>
                      {isArchived ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={savingSettings}
                          onClick={() => void restoreProject()}
                        >
                          Restore project
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={savingSettings}
                          onClick={() => void archiveProject()}
                        >
                          <Archive className="h-3.5 w-3.5" />
                          Archive
                        </Button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>

          <div className="ws-command-strip relative z-[1]" aria-label="Layout">
            <button
              type="button"
              className="ws-strip-chip"
              onClick={() => {
                layout.resetLayout();
                toast.info(t("ws.project.module.reset"));
              }}
            >
              <LayoutGrid className="h-3 w-3" aria-hidden />
              Reset layout
            </button>
            <span className={cn("ws-mod-grid-hint", layout.dragId && "is-visible")}>
              Drop onto a cell · empty lower slots appear while moving
            </span>
          </div>

          {linkedBriefId ? (
            <div className="ws-result-reveal" role="status">
              <p className="ws-result-reveal-kicker">{t("ws.project.briefReady")}</p>
              <h2 className="ws-result-reveal-title">{t("ws.project.briefReadyBody")}</h2>
              <p className="ws-result-reveal-copy">
                Open the brief for this project only — executive summary, PSN lenses, citations, and
                export.
              </p>
              <div className="ws-result-reveal-actions">
                <Link href={`/dashboard/briefs/${linkedBriefId}`}>
                  <Button size="sm">
                    <FileText className="h-3.5 w-3.5" />
                    Open brief
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              "ws-mod-grid relative z-[1]",
              layout.dragId && "is-reordering"
            )}
            style={{
              gridTemplateRows: `repeat(${layout.rowCount}, minmax(7.5rem, auto))`,
            }}
            aria-label="Project module grid"
          >
            {layout.cells.map((cell) => {
              if (cell.kind === "empty") {
                return (
                  <EmptyGridCell
                    key={`e-${cell.col}-${cell.row}`}
                    col={cell.col}
                    row={cell.row}
                    dragId={layout.dragId}
                    overCell={layout.overCell}
                    onDragOverCell={layout.onDragOverCell}
                    onDropCell={layout.onDropCell}
                  />
                );
              }
              const m = cell.module;
              const body = moduleBody[m.id];
              if (body == null) return null;
              if (m.id === "monitors" && linkedMonitors.length === 0) {
                return (
                  <EmptyGridCell
                    key={`e-${m.col}-${m.row}`}
                    col={m.col}
                    row={m.row}
                    dragId={layout.dragId}
                    overCell={layout.overCell}
                    onDragOverCell={layout.onDragOverCell}
                    onDropCell={layout.onDropCell}
                  />
                );
              }
              return (
                <ModuleShell
                  key={m.id}
                  id={m.id}
                  title={titles[m.id] ?? m.id}
                  col={m.col}
                  row={m.row}
                  dragId={layout.dragId}
                  overCell={layout.overCell}
                  onDragStart={layout.onDragStart}
                  onDragEnd={layout.onDragEnd}
                  onDragOverCell={layout.onDragOverCell}
                  onDropCell={layout.onDropCell}
                >
                  {body}
                </ModuleShell>
              );
            })}
          </div>
        </div>
      </LoadingBlur>
    </AppShell>
  );
}

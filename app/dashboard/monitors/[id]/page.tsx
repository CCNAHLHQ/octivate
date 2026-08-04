"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Bell,
  Clock,
  FolderKanban,
  Pause,
  Play,
  Rss,
  ScrollText,
} from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { LoadingBlur } from "@/components/ui/loading-blur";
import { Skeleton } from "@/components/ui/progress";
import { StatusBadge, severityTone } from "@/components/ui/status-badge";
import { toast } from "@/components/ui/toast";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { useWorkspaceRefresh } from "@/lib/hooks/use-workspace-refresh";
import { notifyWorkspaceRefresh } from "@/lib/workspace-events";
import type { Monitor, MonitorSignal, Project } from "@/lib/types";

const SIGNAL_POLL_MS = 45_000;

function formatWhen(iso?: string) {
  if (!iso) return "No alerts recorded yet";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function MonitorDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [signals, setSignals] = useState<MonitorSignal[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [linkedProject, setLinkedProject] = useState<Project | null>(null);
  const [projectLink, setProjectLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSignals = useCallback(async () => {
    const sig = await apiFetch<{ signals: MonitorSignal[]; monitor: Monitor }>(
      `/api/monitors/${id}/signals`,
      { skipCache: true }
    );
    setSignals(sig.signals);
    setMonitor(sig.monitor);
  }, [id]);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    try {
      const [mon, sig, projs] = await Promise.all([
        apiFetch<{ monitor: Monitor }>(`/api/monitors/${id}`, { skipCache: true }),
        apiFetch<{ signals: MonitorSignal[]; monitor: Monitor }>(`/api/monitors/${id}/signals`, {
          skipCache: true,
        }),
        apiFetch<{ projects: Project[] }>("/api/projects", { skipCache: true }),
      ]);
      setMonitor(sig.monitor);
      setSignals(sig.signals);
      setProjects(projs.projects);
      setProjectLink(mon.monitor.projectId ?? "");
      setLinkedProject(
        mon.monitor.projectId
          ? projs.projects.find((p) => p.id === mon.monitor.projectId) ?? null
          : null
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load monitor");
      setMonitor(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useWorkspaceRefresh(() => load(true), ["monitors", "projects"]);

  useEffect(() => {
    if (loading) return;
    const timer = window.setInterval(() => void loadSignals(), SIGNAL_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loading, loadSignals]);

  async function toggleStatus() {
    if (!monitor || busy) return;
    const next = monitor.status === "active" ? "paused" : "active";
    setBusy(true);
    try {
      const data = await apiFetch<{ monitor: Monitor }>(`/api/monitors/${id}`, {
        method: "PATCH",
        json: { status: next },
      });
      setMonitor(data.monitor);
      invalidateApiCache("/api/monitors");
      notifyWorkspaceRefresh(["monitors", "overview"]);
      toast.success(next === "paused" ? "Monitor paused" : "Monitor resumed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update monitor");
    } finally {
      setBusy(false);
    }
  }

  async function saveProjectLink() {
    if (!monitor || busy) return;
    setBusy(true);
    try {
      const data = await apiFetch<{ monitor: Monitor }>(`/api/monitors/${id}`, {
        method: "PATCH",
        json: { projectId: projectLink || null },
      });
      setMonitor(data.monitor);
      setLinkedProject(
        data.monitor.projectId
          ? projects.find((p) => p.id === data.monitor.projectId) ?? null
          : null
      );
      invalidateApiCache("/api/monitors");
      notifyWorkspaceRefresh(["monitors", "projects"]);
      toast.success("Project link updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update link");
    } finally {
      setBusy(false);
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

  if (!monitor) {
    return (
      <AppShell>
        <div className="p-6 text-coral">{error || "Monitor not found"}</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <LoadingBlur active={refreshing} className="mx-auto max-w-[1140px]">
      <div className="space-y-5 p-4 sm:p-6">
        <Link href="/dashboard/monitors" className="ws-breadcrumb">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Monitors
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="ws-eyebrow">Watch profile</p>
            <h1 className="ws-page-title">{monitor.name}</h1>
            <p className="ws-page-desc mt-1">
              {monitor.countries.join(" · ")} — keyword matches feed briefs and the signal ticker.
            </p>
            <div className="mt-3">
              <StatusBadge tone={severityTone(monitor.status)}>{monitor.status}</StatusBadge>
            </div>
          </div>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void toggleStatus()}>
            {monitor.status === "active" ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                Pause monitor
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                Resume monitor
              </>
            )}
          </Button>
        </div>

        <div className="ws-kpi-strip" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <div className="ws-kpi-card is-amber">
            <div className="ws-kpi-top">
              <Bell className="h-3.5 w-3.5" aria-hidden />
              <span className="ws-kpi-label">Alerts</span>
            </div>
            <div className="ws-kpi-value">{monitor.alertCount}</div>
            <div className="ws-kpi-hint">{signals.length} live matches</div>
          </div>
          <div className="ws-kpi-card">
            <div className="ws-kpi-top">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              <span className="ws-kpi-label">Last alert</span>
            </div>
            <div className="ws-kpi-value text-base leading-snug">
              {monitor.lastAlertAt ? formatWhen(monitor.lastAlertAt) : "—"}
            </div>
          </div>
          <div className="ws-kpi-card is-teal">
            <div className="ws-kpi-top">
              <Activity className="h-3.5 w-3.5" aria-hidden />
              <span className="ws-kpi-label">Keywords</span>
            </div>
            <div className="ws-kpi-value">{monitor.keywords.length}</div>
            <div className="ws-kpi-hint">Tracked terms</div>
          </div>
        </div>

        <div className="ws-detail-grid">
          <section className="ws-detail-section space-y-4">
            <div>
              <h2 className="ws-section-label">Keywords</h2>
              <div className="ws-tag-row mt-0">
                {monitor.keywords.map((kw) => (
                  <span key={kw} className="ws-tag">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h2 className="ws-section-label">Jurisdictions</h2>
              <div className="ws-tag-row mt-0">
                {monitor.countries.map((c) => (
                  <span key={c} className="ws-tag">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h2 className="ws-section-label">Live alert feed</h2>
              {signals.length === 0 ? (
                <p className="text-sm leading-relaxed text-mist">
                  No keyword matches in trends or the signal ticker yet. Matches appear when tracked
                  terms land in published signals.
                </p>
              ) : (
                <div className="ws-signal-list">
                  {signals.map((sig) => (
                    <article key={sig.id} className="ws-signal-item">
                      <div className="ws-signal-item-head">
                        <span className="ws-signal-title">{sig.title}</span>
                        <StatusBadge tone={sig.source === "trend" ? severityTone(sig.severity ?? "info") : "violet"}>
                          {sig.source === "trend" ? sig.severity ?? "signal" : "ticker"}
                        </StatusBadge>
                      </div>
                      <p className="ws-signal-summary">{sig.summary}</p>
                      <div className="ws-signal-meta">
                        <span>{formatWhen(sig.publishedAt)}</span>
                        {sig.matchedKeywords.map((kw) => (
                          <span key={kw} className="ws-tag">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <section className="ws-detail-section">
              <h2 className="ws-section-label">Linked project</h2>
              {linkedProject ? (
                <Link href={`/dashboard/projects/${linkedProject.id}`} className="ws-linked-item mb-3">
                  <span className="inline-flex items-center gap-2">
                    <FolderKanban className="h-3.5 w-3.5 text-teal" aria-hidden />
                    {linkedProject.name}
                  </span>
                </Link>
              ) : (
                <p className="mb-3 text-sm text-mist">No project linked yet.</p>
              )}
              <div className="flex flex-col gap-2">
                <Select
                  className="is-teal"
                  value={projectLink}
                  onChange={(e) => setProjectLink(e.target.value)}
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Button size="sm" disabled={busy} onClick={() => void saveProjectLink()}>
                  Save link
                </Button>
              </div>
            </section>

            <section className="ws-detail-section">
              <h2 className="ws-section-label">Quick links</h2>
              <div className="flex flex-col gap-2">
                <Link href="/dashboard/operator#ticker">
                  <Button size="sm" variant="ghost" className="w-full justify-start">
                    <ScrollText className="h-3.5 w-3.5" />
                    Signal ticker
                  </Button>
                </Link>
                <Link href="/dashboard/sources">
                  <Button size="sm" variant="ghost" className="w-full justify-start">
                    <Rss className="h-3.5 w-3.5" />
                    Source packs
                  </Button>
                </Link>
                <Link href="/dashboard/briefs">
                  <Button size="sm" variant="ghost" className="w-full justify-start">
                    <Bell className="h-3.5 w-3.5" />
                    Related briefs
                  </Button>
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
      </LoadingBlur>
    </AppShell>
  );
}

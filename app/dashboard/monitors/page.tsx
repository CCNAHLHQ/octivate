"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Bell, ChevronDown, ChevronRight, Pause, Plus } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { MonitorCard, MonitorCardSkeleton } from "@/components/monitors/monitor-card";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { WorkspaceKpiStrip } from "@/components/workspace/workspace-kpi-strip";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingBlur } from "@/components/ui/loading-blur";
import { toast } from "@/components/ui/toast";
import { useT } from "@/components/i18n/locale-provider";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { useWorkspaceRefresh } from "@/lib/hooks/use-workspace-refresh";
import { notifyWorkspaceRefresh } from "@/lib/workspace-events";
import { sortMonitors, type MonitorSort } from "@/lib/workspace/sort";
import type { Monitor, Project } from "@/lib/types";

type MonitorFilter = "all" | "active" | "paused" | "alerting";

export default function MonitorsPage() {
  const t = useT();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("EPA, petroleum");
  const [countries, setCountries] = useState("Guyana");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MonitorFilter>("all");
  const [sort, setSort] = useState<MonitorSort>("updated");

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setInitialLoading(true);
    try {
      const [mon, projs] = await Promise.all([
        apiFetch<{ monitors: Monitor[] }>("/api/monitors", { skipCache: true }),
        apiFetch<{ projects: Project[] }>("/api/projects", { skipCache: true }),
      ]);
      setMonitors(mon.monitors);
      setProjects(projs.projects);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useWorkspaceRefresh(() => load(true), ["monitors", "projects"]);

  const monitorSorts = useMemo(
    () => [
      { value: "updated" as MonitorSort, label: t("ws.monitors.sort.lastAlert") },
      { value: "alerts" as MonitorSort, label: t("ws.monitors.sort.alertCount") },
      { value: "name" as MonitorSort, label: t("ws.monitors.sort.name") },
      { value: "country" as MonitorSort, label: t("ws.monitors.sort.country") },
    ],
    [t]
  );

  const kpis = useMemo(() => {
    const active = monitors.filter((m) => m.status === "active").length;
    const paused = monitors.filter((m) => m.status === "paused").length;
    const alerts = monitors.reduce((s, m) => s + m.alertCount, 0);
    return [
      {
        label: t("ws.monitors.title"),
        value: monitors.length,
        icon: Activity,
        tone: "violet" as const,
      },
      {
        label: t("ws.projects.filter.active"),
        value: active,
        hint: t("ws.monitors.kpi.watching"),
        icon: Activity,
        tone: "teal" as const,
      },
      {
        label: t("ws.monitors.pause"),
        value: paused,
        icon: Pause,
        tone: "default" as const,
      },
      {
        label: t("ws.monitors.kpi.totalAlerts"),
        value: alerts,
        icon: Bell,
        tone: "amber" as const,
      },
    ];
  }, [monitors, t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = monitors.filter((m) => {
      if (filter === "active" && m.status !== "active") return false;
      if (filter === "paused" && m.status !== "paused") return false;
      if (filter === "alerting" && m.alertCount === 0) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.countries.some((c) => c.toLowerCase().includes(q)) ||
        m.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
    return sortMonitors(items, sort);
  }, [monitors, search, filter, sort]);

  const projectNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.name);
    return map;
  }, [projects]);

  const filters = useMemo(
    () => [
      { id: "all", label: t("ws.projects.filter.all"), count: monitors.length },
      {
        id: "active",
        label: t("ws.projects.filter.active"),
        count: monitors.filter((m) => m.status === "active").length,
      },
      {
        id: "alerting",
        label: t("ws.monitors.kpi.withAlerts"),
        count: monitors.filter((m) => m.alertCount > 0).length,
      },
      {
        id: "paused",
        label: t("ws.monitors.pause"),
        count: monitors.filter((m) => m.status === "paused").length,
      },
    ],
    [monitors, t]
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/monitors", {
        method: "POST",
        json: {
          name,
          keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
          countries: countries.split(",").map((k) => k.trim()).filter(Boolean),
          ...(projectId ? { projectId } : {}),
        },
      });
      invalidateApiCache("/api/monitors");
      notifyWorkspaceRefresh(["monitors", "overview"]);
      setName("");
      setProjectId("");
      setCreateOpen(false);
      toast.success(t("ws.monitors.created"));
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("ws.monitors.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1140px] space-y-5 p-4 sm:p-6">
        <WorkspacePageHeader
          eyebrow={t("ws.section.workspace")}
          title={t("ws.monitors.title")}
          description={t("ws.monitors.lede")}
        />

        <WorkspaceKpiStrip items={kpis} />

        <WorkspaceToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t("ws.monitors.search")}
          filters={filters}
          activeFilter={filter}
          onFilterChange={(id) => setFilter(id as MonitorFilter)}
          sort={sort}
          sortOptions={monitorSorts}
          onSortChange={(value) => setSort(value as MonitorSort)}
        />

        <div className="ws-create-panel">
          <button
            type="button"
            className="ws-create-panel-head"
            onClick={() => setCreateOpen((o) => !o)}
            aria-expanded={createOpen}
          >
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-faint">
              {t("ws.monitors.add")}
            </span>
            {createOpen ? (
              <ChevronDown className="h-4 w-4 text-mist" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 text-mist" aria-hidden />
            )}
          </button>
          {createOpen && (
            <div className="ws-create-panel-body">
              <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder={t("ws.monitors.name")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  placeholder={t("ws.monitors.keywords")}
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  required
                />
                <Input
                  placeholder={t("ws.monitors.countries")}
                  value={countries}
                  onChange={(e) => setCountries(e.target.value)}
                  required
                />
                <Select
                  className="is-teal"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">{t("ws.monitors.linkProject")}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <div className="sm:col-span-2">
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving ? t("ws.monitors.adding") : t("ws.monitors.add")}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>

        {initialLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <MonitorCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <WorkspaceEmptyState
            icon={Activity}
            title={monitors.length === 0 ? t("ws.monitors.empty") : t("ws.monitors.noMatches")}
            description={
              monitors.length === 0 ? t("ws.monitors.emptyHint") : t("ws.monitors.noMatchesHint")
            }
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                {t("ws.monitors.add")}
              </Button>
            }
          />
        ) : (
          <LoadingBlur active={refreshing}>
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((m) => (
                <MonitorCard
                  key={m.id}
                  monitor={m}
                  projectName={m.projectId ? projectNames.get(m.projectId) : undefined}
                />
              ))}
            </div>
          </LoadingBlur>
        )}
      </div>
    </AppShell>
  );
}

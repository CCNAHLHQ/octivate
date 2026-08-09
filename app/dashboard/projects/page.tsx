"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FolderKanban, Globe, Sparkles } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { ProjectCard, ProjectCardSkeleton } from "@/components/projects/project-card";
import {
  CountrySelect,
  SectorSelect,
} from "@/components/projects/country-sector-fields";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { WorkspaceKpiStrip } from "@/components/workspace/workspace-kpi-strip";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingBlur } from "@/components/ui/loading-blur";
import { toast } from "@/components/ui/toast";
import { useT } from "@/components/i18n/locale-provider";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { useWorkspaceRefresh } from "@/lib/hooks/use-workspace-refresh";
import { notifyWorkspaceRefresh } from "@/lib/workspace-events";
import { sortProjects, type ProjectSort } from "@/lib/workspace/sort";
import type { Project } from "@/lib/types";

type StatusFilter = "all" | "active" | "archived" | "needs-question";

export default function ProjectsPage() {
  const t = useT();
  const [projects, setProjects] = useState<Project[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("Guyana");
  const [sector, setSector] = useState("Energy");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<ProjectSort>("updated");

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setInitialLoading(true);
    try {
      const data = await apiFetch<{ projects: Project[] }>("/api/projects", { skipCache: true });
      setProjects(data.projects);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useWorkspaceRefresh(() => load(true), ["projects"]);

  const projectSorts = useMemo(
    () => [
      { value: "updated" as ProjectSort, label: t("ws.projects.sort.updated") },
      { value: "name" as ProjectSort, label: t("ws.projects.sort.name") },
      { value: "country" as ProjectSort, label: t("ws.projects.sort.country") },
    ],
    [t]
  );

  const kpis = useMemo(() => {
    const active = projects.filter((p) => p.status === "active").length;
    const withQuestion = projects.filter((p) => p.question?.trim()).length;
    const countries = new Set(projects.map((p) => p.country)).size;
    return [
      {
        label: t("ws.projects.kpi.projects"),
        value: projects.length,
        icon: FolderKanban,
        tone: "violet" as const,
      },
      {
        label: t("ws.projects.kpi.active"),
        value: active,
        hint: t("ws.projects.kpi.activeHint"),
        icon: Sparkles,
        tone: "teal" as const,
      },
      {
        label: t("ws.projects.kpi.withQuestion"),
        value: withQuestion,
        hint: t("ws.projects.kpi.withQuestionHint"),
        icon: Sparkles,
        tone: "default" as const,
      },
      {
        label: t("ws.projects.kpi.countries"),
        value: countries,
        icon: Globe,
        tone: "default" as const,
      },
    ];
  }, [projects, t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = projects.filter((p) => {
      if (filter === "active" && p.status !== "active") return false;
      if (filter === "archived" && p.status !== "archived") return false;
      if (filter === "needs-question" && p.question?.trim()) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q) ||
        p.sector.toLowerCase().includes(q) ||
        p.question?.toLowerCase().includes(q)
      );
    });
    return sortProjects(items, sort);
  }, [projects, search, filter, sort]);

  const filters = useMemo(
    () => [
      { id: "all", label: t("ws.projects.filter.all"), count: projects.length },
      {
        id: "active",
        label: t("ws.projects.filter.active"),
        count: projects.filter((p) => p.status === "active").length,
      },
      {
        id: "needs-question",
        label: t("ws.projects.filter.needsQuestion"),
        count: projects.filter((p) => !p.question?.trim()).length,
      },
      {
        id: "archived",
        label: t("ws.projects.filter.archived"),
        count: projects.filter((p) => p.status === "archived").length,
      },
    ],
    [projects, t]
  );

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/projects", {
        method: "POST",
        json: { name, country, sector },
      });
      invalidateApiCache("/api/projects");
      notifyWorkspaceRefresh(["projects", "overview"]);
      setName("");
      setCreateOpen(false);
      toast.success(t("ws.projects.createdTitle"));
      void import("@/lib/alerts/notify").then(({ octivateAlert }) =>
        octivateAlert({
          kind: "success",
          title: t("ws.projects.createdTitle"),
          body: t("ws.projects.createdBody"),
          href: "/dashboard/projects",
        })
      );
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("ws.projects.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1140px] space-y-5 p-4 sm:p-6">
        <WorkspacePageHeader
          eyebrow={t("ws.section.workspace")}
          title={t("ws.projects.title")}
          description={t("ws.projects.lede")}
        />

        <WorkspaceKpiStrip items={kpis} />

        <WorkspaceToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t("ws.projects.search")}
          filters={filters}
          activeFilter={filter}
          onFilterChange={(id) => setFilter(id as StatusFilter)}
          sort={sort}
          sortOptions={projectSorts}
          onSortChange={(value) => setSort(value as ProjectSort)}
        />

        <div className="ws-create-panel">
          <button
            type="button"
            className="ws-create-panel-head"
            data-tour="projects-new"
            onClick={() => setCreateOpen((o) => !o)}
            aria-expanded={createOpen}
          >
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-faint">
              {t("ws.projects.new")}
            </span>
            {createOpen ? (
              <ChevronDown className="h-4 w-4 text-mist" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 text-mist" aria-hidden />
            )}
          </button>
          {createOpen && (
            <div className="ws-create-panel-body">
              <form onSubmit={createProject} className="grid gap-3 sm:grid-cols-4">
                <Input
                  placeholder={t("ws.projects.name")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="sm:col-span-2"
                />
                <CountrySelect value={country} onChange={setCountry} required />
                <SectorSelect value={sector} onChange={setSector} required />
                <div className="sm:col-span-4">
                  <Button type="submit" size="sm" disabled={saving || !name.trim() || !country || !sector}>
                    {saving ? t("ws.projects.creating") : t("ws.projects.create")}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>

        {initialLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <WorkspaceEmptyState
            icon={FolderKanban}
            title={projects.length === 0 ? t("ws.projects.empty") : t("ws.projects.noMatches")}
            description={
              projects.length === 0 ? t("ws.projects.emptyHint") : t("ws.projects.noMatchesHint")
            }
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Sparkles className="h-3.5 w-3.5" />
                {t("ws.projects.create")}
              </Button>
            }
          />
        ) : (
          <LoadingBlur active={refreshing}>
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </LoadingBlur>
        )}
      </div>
    </AppShell>
  );
}

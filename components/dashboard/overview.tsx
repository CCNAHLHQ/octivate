"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { OverviewStatCard } from "@/components/dashboard/overview-stat-card";
import { TopicStarters } from "@/components/dashboard/topic-starters";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingBlur } from "@/components/ui/loading-blur";
import { ProgressBar } from "@/components/ui/progress";
import { StatusBadge, severityTone } from "@/components/ui/status-badge";
import {
  LazyConfidenceGauge,
  LazyDonutChart,
  LazyDistBars,
} from "@/components/ui/lazy-charts";
import { WorkspaceToolbar } from "@/components/workspace/workspace-toolbar";
import { Skeleton } from "@/components/ui/progress";
import { useT } from "@/components/i18n/locale-provider";
import { apiFetch } from "@/lib/api-client";
import { useWorkspaceRefresh } from "@/lib/hooks/use-workspace-refresh";
import type { Brief, CountryPack, Monitor, Project, Trend, UsageSnapshot } from "@/lib/types";
import { setLocationHash } from "@/lib/navigation/hash";
import { cn } from "@/lib/utils";

const RISK_LEVELS = ["critical", "high", "medium", "low"] as const;
const RISK_COLORS: Record<(typeof RISK_LEVELS)[number], string> = {
  critical: "#FF6B5B",
  high: "#F97316",
  medium: "#F5B84B",
  low: "#2DD4BF",
};

type OverviewTab = "insights" | "pipeline";

function tabFromHash(hash: string): OverviewTab {
  const h = hash.replace("#", "");
  if (h === "pipeline" || h === "workspace" || h === "topics") return "pipeline";
  return "insights";
}

function buildRiskItems(briefs: Brief[]) {
  return RISK_LEVELS.map((level) => ({
    label: level.charAt(0).toUpperCase() + level.slice(1),
    value: briefs.filter((b) => b.riskLevel === level).length,
    color: RISK_COLORS[level],
  }));
}

export function OverviewDashboard() {
  const t = useT();
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [packs, setPacks] = useState<CountryPack[]>([]);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [tab, setTab] = useState<OverviewTab>("insights");

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setInitialLoading(true);
    try {
      const [b, t, p, m, pk, u] = await Promise.all([
        apiFetch<{ briefs: Brief[] }>("/api/briefs", { skipCache: true }),
        apiFetch<{ trends: Trend[] }>("/api/trends", { skipCache: true }),
        apiFetch<{ projects: Project[] }>("/api/projects", { skipCache: true }),
        apiFetch<{ monitors: Monitor[] }>("/api/monitors", { skipCache: true }),
        apiFetch<{ packs: CountryPack[] }>("/api/packs", { skipCache: true }),
        apiFetch<{ usage: UsageSnapshot }>("/api/usage", { skipCache: true }),
      ]);
      setBriefs(b.briefs);
      setTrends(t.trends);
      setProjects(p.projects);
      setMonitors(m.monitors);
      setPacks(pk.packs);
      setUsage(u.usage);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setTab(tabFromHash(window.location.hash));
    const onHash = () => setTab(tabFromHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useWorkspaceRefresh(() => load(true), ["overview", "projects", "monitors", "briefs"]);

  function selectTab(next: OverviewTab) {
    setTab(next);
    setLocationHash(next);
  }

  const avgConfidence =
    briefs.length > 0 ? briefs.reduce((s, b) => s + b.confidence, 0) / briefs.length : 0;

  const riskItems = useMemo(() => buildRiskItems(briefs), [briefs]);

  const packChartItems = useMemo(
    () =>
      [...packs]
        .sort((a, b) => b.sources - a.sources)
        .slice(0, 5)
        .map((p, i) => ({
          label: p.country,
          value: p.sources,
          color: ["#A855F7", "#2DD4BF", "#FF6B5B", "#F5B84B", "#78A0FF"][i % 5],
        })),
    [packs]
  );

  const usagePct = usage ? Math.min(100, (usage.tokensUsed / usage.tokensLimit) * 100) : 0;

  const pipelineCount = projects.length + monitors.length + briefs.length;

  const statCards = initialLoading
    ? null
    : [
        {
          key: "risk",
          node: (
            <OverviewStatCard title={t("ws.overview.riskMix")} subtitle={t("ws.overview.riskMixSub")}>
              <LazyDistBars
                items={riskItems}
                heightClass="h-[12.5rem]"
                valueLabel={t("ws.overview.briefsLabel")}
              />
            </OverviewStatCard>
          ),
        },
        {
          key: "trends",
          node: (
            <OverviewStatCard title={t("ws.overview.latestTrends")} bodyClassName="is-top">
              <ul className="overview-trends-list">
                {trends.slice(0, 4).map((tr) => (
                  <li key={tr.id} className="overview-trends-item">
                    <span className="font-medium text-foam line-clamp-2">{tr.title}</span>
                    <StatusBadge tone={severityTone(tr.severity)}>{tr.severity}</StatusBadge>
                  </li>
                ))}
              </ul>
            </OverviewStatCard>
          ),
        },
        {
          key: "confidence",
          node: (
            <OverviewStatCard title={t("ws.overview.avgConfidence")}>
              <LazyConfidenceGauge value={avgConfidence} />
            </OverviewStatCard>
          ),
        },
        {
          key: "briefs",
          node: (
            <OverviewStatCard
              title={t("ws.overview.briefs")}
              subtitle={`${briefs.length} ${t("ws.overview.total")}`}
            >
              <LazyDonutChart
                centerLabel={t("ws.overview.total")}
                segments={[
                  {
                    name: t("ws.overview.final"),
                    value: briefs.filter((b) => b.status === "final").length,
                  },
                  {
                    name: t("ws.overview.draft"),
                    value: briefs.filter((b) => b.status === "draft").length,
                  },
                ]}
              />
            </OverviewStatCard>
          ),
        },
        {
          key: "packs",
          node: (
            <OverviewStatCard
              title={t("ws.overview.countryPacks")}
              subtitle={t("ws.overview.caribbeanMarkets").replace("{n}", String(packs.length))}
              bodyClassName="is-top"
            >
              <LazyDistBars
                items={packChartItems}
                heightClass="h-[11rem]"
                valueLabel={t("ws.overview.sourcesLabel")}
              />
              <div className="overview-pack-foot">
                {packs.slice(0, 4).map((p) => (
                  <span key={p.id} className="overview-pack-chip">
                    {p.country} · {p.sources} src
                  </span>
                ))}
              </div>
            </OverviewStatCard>
          ),
        },
        {
          key: "usage",
          node: usage ? (
            <OverviewStatCard
              title={t("ws.overview.aiUsage")}
              subtitle={usage.period}
              bodyClassName="is-top"
            >
              <div className="overview-usage-split">
                <LazyDonutChart
                  centerLabel={t("ws.overview.runsLabel")}
                  segments={[
                    { name: t("ws.overview.briefs"), value: usage.briefsGenerated },
                    { name: t("ws.overview.sessions"), value: usage.sessionsRun },
                  ]}
                />
                <div className="overview-usage-meter">
                  <ProgressBar value={usagePct} />
                  <p className="overview-usage-tokens">
                    {usage.tokensUsed.toLocaleString()}
                    <span>
                      {" "}
                      / {usage.tokensLimit.toLocaleString()} {t("ws.overview.tokens")}
                    </span>
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-teal">
                    {t("ws.overview.estCost").replace(
                      "{amount}",
                      usage.estimatedCostUsd.toFixed(2)
                    )}
                  </p>
                </div>
              </div>
            </OverviewStatCard>
          ) : null,
        },
      ].filter((c) => c.node);

  return (
    <AppShell>
      <div className="overview-page mx-auto max-w-[1280px] space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foam sm:text-3xl">
              {t("ws.overview.title")}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-mist">{t("ws.overview.lede")}</p>
          </div>
          <Link href="/dashboard/projects">
            <Button size="sm">
              <Sparkles className="h-3.5 w-3.5" />
              {t("ws.overview.newAnalysis")}
            </Button>
          </Link>
        </div>

        <div className="overview-tabs-bar">
          <WorkspaceToolbar
            search=""
            onSearchChange={() => {}}
            showSearch={false}
            filters={[
              { id: "insights", label: t("ws.overview.tab.insights") },
              {
                id: "pipeline",
                label: t("ws.overview.tab.pipeline"),
                count: pipelineCount || undefined,
              },
            ]}
            activeFilter={tab}
            onFilterChange={(id) => selectTab(id as OverviewTab)}
            className="overview-tabs-toolbar"
          />
        </div>

        {initialLoading ? (
          <div className="overview-stat-grid is-primary">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[18.5rem] rounded-[var(--r-lg)]" />
            ))}
          </div>
        ) : (
          <LoadingBlur active={refreshing}>
            <AnimatePresence mode="wait">
              {tab === "insights" ? (
                <motion.div
                  key="insights"
                  className="overview-tab-panel space-y-5"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="overview-stat-grid is-primary">
                    {statCards?.slice(0, 4).map(({ key, node }, i) => (
                      <motion.div
                        key={key}
                        className="h-full"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      >
                        {node}
                      </motion.div>
                    ))}
                  </div>

                  <div className="overview-stat-grid is-secondary">
                    {statCards?.slice(4).map(({ key, node }, i) => (
                      <motion.div
                        key={key}
                        className="h-full xl:col-span-1"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      >
                        {node}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="pipeline"
                  className={cn("overview-tab-panel overview-pipeline-pane space-y-5")}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                >
                  <Card className="overview-pipeline-banner">
                    <div className="overview-pipeline-banner-glow" aria-hidden />
                    <div className="relative flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="overview-pipeline-banner-label">
                          <Sparkles className="h-4 w-4" />
                          <span className="font-mono text-[10px] uppercase tracking-widest">
                            {t("ws.overview.agenticPipeline")}
                          </span>
                        </div>
                        <p className="mt-1 max-w-lg text-sm text-mist">
                          {t("ws.overview.agenticLede")}
                        </p>
                      </div>
                      <Link href="/dashboard/projects">
                        <Button size="sm">
                          {t("ws.overview.startWorkflow")}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </Card>

                  <Card className="overview-topics-card p-5">
                    <div>
                      <TopicStarters />
                    </div>
                  </Card>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <Card className="overview-briefs-card p-4 lg:col-span-2">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h2 className="font-mono text-[10px] uppercase tracking-widest text-faint">
                          {t("ws.overview.latestBriefs")}
                        </h2>
                        <Link
                          href="/dashboard/briefs"
                          className="shrink-0 text-xs text-violet hover:underline"
                        >
                          {t("ws.overview.viewAll")}
                        </Link>
                      </div>
                      <div className="overview-briefs-table-wrap">
                        <table className="overview-briefs-table w-full table-fixed text-left text-sm">
                          <thead>
                            <tr>
                              <th>{t("ws.overview.col.title")}</th>
                              <th>{t("ws.overview.col.country")}</th>
                              <th>{t("ws.overview.col.risk")}</th>
                              <th>{t("ws.overview.col.confidence")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {briefs.slice(0, 8).map((b) => (
                              <tr key={b.id} className="overview-pipeline-row">
                                <td>
                                  <Link
                                    href={`/dashboard/briefs/${b.id}`}
                                    className="overview-briefs-title"
                                    title={b.title}
                                  >
                                    {b.title}
                                  </Link>
                                </td>
                                <td>
                                  <span className="overview-briefs-country" title={b.country}>
                                    {b.country}
                                  </span>
                                </td>
                                <td>
                                  <StatusBadge tone={severityTone(b.riskLevel)}>
                                    {b.riskLevel}
                                  </StatusBadge>
                                </td>
                                <td>
                                  <Link
                                    href={`/dashboard/briefs/${b.id}`}
                                    className="overview-briefs-confidence"
                                    title={`${b.confidence}% model confidence`}
                                  >
                                    {b.confidence}%
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    <div className="space-y-4">
                      <Card className="overview-side-card p-4">
                        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-faint">
                          {t("ws.overview.activeProjects")}
                        </h2>
                        <ul className="space-y-2">
                          {projects.slice(0, 6).map((p) => (
                            <li key={p.id}>
                              <Link
                                href={`/dashboard/projects/${p.id}`}
                                className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-[var(--ghost-hover-bg)]"
                              >
                                <span className="text-foam line-clamp-1">{p.name}</span>
                                <span className="shrink-0 font-mono text-[10px] text-faint">
                                  {p.country}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </Card>
                      <Card className="overview-side-card p-4">
                        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-faint">
                          {t("ws.overview.monitoring")}
                        </h2>
                        <ul className="space-y-2 text-sm">
                          {monitors.slice(0, 5).map((m) => (
                            <li key={m.id} className="flex items-center justify-between gap-2">
                              <Link
                                href={`/dashboard/monitors/${m.id}`}
                                className="text-foam line-clamp-1 hover:text-teal"
                              >
                                {m.name}
                              </Link>
                              <StatusBadge tone={severityTone(m.status)}>{m.status}</StatusBadge>
                            </li>
                          ))}
                        </ul>
                      </Card>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </LoadingBlur>
        )}
      </div>
    </AppShell>
  );
}

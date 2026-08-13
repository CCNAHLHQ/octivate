"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  Coins,
  Database,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import {
  OperatorCatalogBoard,
  OperatorControlBoard,
  OperatorPulseBoard,
  buildOperatorCharts,
} from "@/components/operator/operator-boards";
import {
  CONTROL_AUTOSAVE_MS,
  type AutosaveStatus,
} from "@/components/operator/autosave-status";
import { OperatorMainTabs } from "@/components/operator/operator-main-tabs";
import { OperatorOperationsPanel } from "@/components/operator/operator-operations-panel";
import { OperatorExportTemplatesPanel } from "@/components/operator/operator-export-templates-panel";
import { OperatorPricingPanel } from "@/components/operator/operator-pricing-panel";
import { OperatorAutomationPanel } from "@/components/operator/operator-automation-panel";
import { OperatorDebugPanel } from "@/components/operator/operator-debug-panel";
import { OperatorSupportInbox } from "@/components/operator/operator-support-inbox";
import {
  OperatorMailPanel,
  OperatorUsersPanel,
} from "@/components/operator/operator-mail-panel";
import type { CostSummary, Health, OperatorTab } from "@/components/operator/operator-types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { toast } from "@/components/ui/toast";
import { useT } from "@/components/i18n/locale-provider";
import { apiFetch, getClientApiKey, invalidateApiCache } from "@/lib/api-client";
import { moderateDelete } from "@/lib/moderation/client";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AgentSession, CostEntry, OperatorLimits, Source, UsageSnapshot } from "@/lib/types";
import type { ModerationCollection } from "@/lib/moderation/constants";
import { setLocationHash } from "@/lib/navigation/hash";
import { cn } from "@/lib/utils";

function mainTabFromHash(hash: string): OperatorTab {
  const h = hash.replace("#", "");
  if (h === "exports") return "exports";
  if (h === "pricing") return "pricing";
  if (
    h === "automation" ||
    h === "parliament" ||
    h === "parl" ||
    h === "media"
  ) {
    return "automation";
  }
  if (h === "debug" || h === "logs") return "debug";
  if (h === "support" || h === "inbox") return "support";
  if (h === "mail" || h === "mailing") return "mail";
  if (h === "users" || h === "accounts") return "users";
  if (h === "catalog" || h === "sources" || h === "ticker") return "catalog";
  if (h === "control" || h === "limits" || h === "health" || h === "models") return "control";
  if (
    h === "operations" ||
    h === "ledger" ||
    h === "sessions" ||
    h === "moderation"
  ) {
    return "operations";
  }
  if (!h || h === "overview" || h === "pulse") return "pulse";
  return "pulse";
}

export function OperatorConsole() {
  const t = useT();
  const [limits, setLimits] = useState<OperatorLimits | null>(null);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [modCounts, setModCounts] = useState<Record<ModerationCollection, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [limitsSaveStatus, setLimitsSaveStatus] = useState<AutosaveStatus>("saved");
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mainTab, setMainTab] = useState<OperatorTab>("pulse");
  const [pendingReviews, setPendingReviews] = useState<{
    count: number;
    pending: {
      id: string;
      title: string;
      ownerName?: string;
      ownerEmail?: string;
      projectName?: string;
    }[];
  } | null>(null);
  const [sourceCount, setSourceCount] = useState(0);
  const [retrievalUrlCount, setRetrievalUrlCount] = useState(0);

  const limitsRef = useRef<OperatorLimits | null>(null);
  const limitsSavedSnapRef = useRef("");
  const limitsTimerRef = useRef<number | null>(null);
  const limitsSaveChainRef = useRef(Promise.resolve<void>(undefined));
  const { ask, dialog: confirmDialog } = useConfirmDialog();

  limitsRef.current = limits;

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    try {
      if (limitsTimerRef.current) {
        window.clearTimeout(limitsTimerRef.current);
        limitsTimerRef.current = null;
      }
      // Always skip in-memory GET cache for live ops accounting.
      const live = { skipCache: true as const };
      const [lim, cost, sess, h, u, mod, rev, src] = await Promise.all([
        apiFetch<{ limits: OperatorLimits }>("/api/operator/limits", live),
        apiFetch<{ costs: CostEntry[]; summary: CostSummary }>("/api/operator/costs", live),
        apiFetch<{ sessions: AgentSession[] }>("/api/agents/sessions", live),
        apiFetch<Health>("/api/health", live),
        apiFetch<{ usage: UsageSnapshot }>("/api/usage", live),
        apiFetch<{ counts: Record<ModerationCollection, number> }>("/api/operator/moderation", live),
        apiFetch<{
          count: number;
          pending: {
            id: string;
            title: string;
            ownerName?: string;
            ownerEmail?: string;
            projectName?: string;
          }[];
        }>("/api/operator/reviews", live),
        apiFetch<{ sources: Source[]; count?: number }>("/api/sources", live).catch(() => ({
          sources: [] as Source[],
          count: 0,
        })),
      ]);
      setLimits(lim.limits);
      limitsRef.current = lim.limits;
      limitsSavedSnapRef.current = JSON.stringify(lim.limits);
      setLimitsSaveStatus("saved");
      setCosts(cost.costs);
      setSummary(cost.summary);
      setSessions(sess.sessions);
      setHealth(h);
      setUsage(u.usage);
      setModCounts(mod.counts);
      setPendingReviews({
        count: rev.count,
        pending: rev.pending.map((b) => ({ id: b.id, title: b.title })),
      });
      const list = src.sources || [];
      setSourceCount(src.count ?? list.length);
      setRetrievalUrlCount(list.filter((s) => !!(s.primaryRetrievalUrl || s.url)).length);
      setRefreshKey((k) => k + 1);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load().catch(() => {
      setLoading(false);
      toast.error(t("op.pulse.loadFailed"));
    });
  }, [load]);

  // Soft poll + ops-stream accounting ticks so all operators stay live.
  useEffect(() => {
    let cancelled = false;
    const soft = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      void load(true).catch(() => undefined);
    };
    const poll = window.setInterval(soft, 8_000);

    const key = getClientApiKey();
    const ctrl = new AbortController();
    let debounce: number | null = null;

    async function watchAccounting() {
      try {
        const res = await fetch("/api/operator/logs/stream", {
          headers: key ? { Authorization: `Bearer ${key}` } : {},
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!res.ok || !res.body) return;
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
            const line = chunk.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            try {
              const evt = JSON.parse(line.slice(5).trim()) as { message?: string };
              if (typeof evt.message === "string" && evt.message.startsWith("accounting:")) {
                if (debounce) window.clearTimeout(debounce);
                debounce = window.setTimeout(soft, 350);
              }
            } catch {
              /* ignore malformed */
            }
          }
        }
      } catch {
        /* stream ended / aborted */
      }
    }
    void watchAccounting();

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      if (debounce) window.clearTimeout(debounce);
      ctrl.abort();
    };
  }, [load]);

  useEffect(() => {
    const apply = () => setMainTab(mainTabFromHash(window.location.hash));
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  function selectMainTab(tab: OperatorTab) {
    setMainTab(tab);
    setLocationHash(tab);
  }

  const runningSessions = useMemo(
    () => sessions.filter((s) => s.status === "pending" || s.status === "running").length,
    [sessions]
  );

  const storedTotal = useMemo(() => {
    if (!modCounts) return 0;
    return Object.values(modCounts).reduce((a, b) => a + b, 0);
  }, [modCounts]);

  const tokenPct = useMemo(() => {
    if (!limits || !usage) return 0;
    return Math.round((usage.tokensUsed / Math.max(limits.tokensPerDay, 1)) * 100);
  }, [limits, usage]);

  const costByModel = useMemo(() => {
    const rows =
      summary?.byModel?.length
        ? summary.byModel
        : (() => {
            const period = summary?.period;
            const map = new Map<string, number>();
            for (const c of costs) {
              if (period && !c.at.startsWith(period)) continue;
              map.set(c.model, (map.get(c.model) || 0) + c.costUsd);
            }
            return [...map.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([model, costUsd]) => ({ model, costUsd }));
          })();

    return rows.slice(0, 5).map((row, i) => {
      const label = row.model.length > 14 ? `${row.model.slice(0, 14)}…` : row.model;
      return {
        label,
        value: Math.round(row.costUsd * 10000) / 10000,
        color: ["#A855F7", "#2DD4BF", "#FF6B5B", "#F5B84B", "#78A0FF"][i % 5],
      };
    });
  }, [costs, summary]);

  async function persistLimits() {
    const next = limitsRef.current;
    if (!next) return;
    if (JSON.stringify(next) === limitsSavedSnapRef.current) {
      setLimitsSaveStatus("saved");
      return;
    }

    const payload: OperatorLimits = {
      ...next,
      tokensPerDay: Math.round(Number(next.tokensPerDay)) || next.tokensPerDay,
      concurrentAgents: Math.round(Number(next.concurrentAgents)) || next.concurrentAgents,
      maxUploadsPerProject:
        Math.round(Number(next.maxUploadsPerProject)) || next.maxUploadsPerProject,
      maxFileSizeMb: Math.round(Number(next.maxFileSizeMb)) || next.maxFileSizeMb,
      maxAvatarSizeKb: Math.min(
        10_240,
        Math.max(1024, Math.round(Number(next.maxAvatarSizeKb)) || 2048)
      ),
      maxProfileBioChars: Math.min(
        10_000,
        Math.max(200, Math.round(Number(next.maxProfileBioChars)) || 2000)
      ),
      documentRetentionDays: Math.min(
        3650,
        Math.max(1, Math.round(Number(next.documentRetentionDays)) || 30)
      ),
      mockOpenRouter: false,
    };

    // Skip autosave while a field is mid-edit with invalid/NaN numeric state.
    if (
      !Number.isFinite(payload.tokensPerDay) ||
      !Number.isFinite(payload.concurrentAgents) ||
      !Number.isFinite(payload.maxUploadsPerProject) ||
      !Number.isFinite(payload.maxFileSizeMb) ||
      !Number.isFinite(payload.maxAvatarSizeKb) ||
      !Number.isFinite(payload.maxProfileBioChars) ||
      !Number.isFinite(payload.documentRetentionDays)
    ) {
      return;
    }

    setLimitsSaveStatus("saving");
    try {
      const data = await apiFetch<{
        limits: OperatorLimits;
        retention?: { recomputed: number; queued: number; deleted: number } | null;
      }>("/api/operator/limits", {
        method: "PATCH",
        json: payload,
      });
      invalidateApiCache("/api/operator");
      invalidateApiCache("/api/health");
      limitsRef.current = data.limits;
      limitsSavedSnapRef.current = JSON.stringify(data.limits);
      setLimits(data.limits);
      setLimitsSaveStatus("saved");
      if (data.retention) {
        toast.success(
          `Retention updated — ${data.retention.recomputed} docs recomputed, ${data.retention.queued} queued, ${data.retention.deleted} deleted`
        );
      }
      const h = await apiFetch<Health>("/api/health", { skipCache: true });
      setHealth(h);
    } catch (err) {
      setLimitsSaveStatus("error");
      toast.error(err instanceof Error ? err.message : "Failed to autosave limits");
    }
  }

  function clearLimitsTimer() {
    if (limitsTimerRef.current) {
      window.clearTimeout(limitsTimerRef.current);
      limitsTimerRef.current = null;
    }
  }

  function scheduleLimitsSave() {
    if (limitsRef.current && JSON.stringify(limitsRef.current) !== limitsSavedSnapRef.current) {
      setLimitsSaveStatus((status) => (status === "saving" ? "saving" : "dirty"));
    }
    clearLimitsTimer();
    limitsTimerRef.current = window.setTimeout(() => {
      limitsSaveChainRef.current = limitsSaveChainRef.current
        .then(() => persistLimits())
        .catch(() => undefined);
    }, CONTROL_AUTOSAVE_MS);
  }

  function updateLimits(next: OperatorLimits) {
    limitsRef.current = next;
    setLimits(next);
    scheduleLimitsSave();
  }

  function flushLimitsSave() {
    clearLimitsTimer();
    limitsSaveChainRef.current = limitsSaveChainRef.current
      .then(() => persistLimits())
      .catch(() => undefined);
  }

  useEffect(() => () => clearLimitsTimer(), []);

  async function deleteStored(
    collection: ModerationCollection,
    id: string,
    label: string
  ) {
    const ok = await ask({
      title: `Delete this ${label}?`,
      description: "This permanently removes the selected record.\n\nThis cannot be undone.",
      confirmLabel: "Delete",
    });
    if (!ok) {
      toast.info("Deletion cancelled");
      return;
    }
    setBusyId(id);
    try {
      const res = await moderateDelete(collection, id);
      toast.success(res.message || "Deleted");
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  async function refresh() {
    try {
      await load(true);
      toast.success(t("op.pulse.refreshed"));
    } catch {
      toast.error(t("op.pulse.refreshFailed"));
    }
  }

  async function clearReviews(scope: "stale" | "all") {
    const ok = await ask({
      title: scope === "all" ? "Clear all pending reviews?" : "Clear stale seed reviews?",
      description:
        scope === "all"
          ? "Marks every pending brief review as rejected and updates human-review records. Propagates live to operators."
          : "Only clears pending reviews with no owning account (seed/orphan).",
      confirmLabel: scope === "all" ? "Clear all reviews" : "Clear stale",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const res = await apiFetch<{
        cleared: number;
        reviewsCleared?: number;
        count: number;
        pending: NonNullable<typeof pendingReviews>["pending"];
      }>("/api/operator/reviews", {
        method: "DELETE",
        json: { scope },
      });
      invalidateApiCache();
      setPendingReviews({ count: res.count, pending: res.pending || [] });
      toast.success(
        res.cleared || res.reviewsCleared
          ? `Cleared ${res.cleared} brief(s)` +
              (res.reviewsCleared ? ` · ${res.reviewsCleared} review row(s)` : "")
          : "Nothing to clear"
      );
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clear failed");
    }
  }

  async function clearAllCosts() {
    const ok = await ask({
      title: "Reset cost ledger?",
      description:
        "Deletes every Supabase cost_ledger row and zeros period usage. In-flight sessions keep local counters until they flush.",
      confirmLabel: "Clear ledger",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const res = await apiFetch<{
        deletedCosts: number;
        costs: CostEntry[];
        summary: CostSummary;
        usage: UsageSnapshot;
      }>("/api/operator/costs", { method: "DELETE" });
      invalidateApiCache();
      setCosts([]);
      setSummary(res.summary);
      setUsage(res.usage);
      toast.success(`Cleared ${res.deletedCosts} ledger row(s)`);
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ledger clear failed");
    }
  }

  async function clearAllSessions() {
    const ok = await ask({
      title: "Clear all sessions?",
      description:
        "Removes every agent session from Supabase and memory. Does not delete the cost ledger (use Clear ledger).",
      confirmLabel: "Clear sessions",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const res = await apiFetch<{ cleared: number }>("/api/agents/sessions", {
        method: "DELETE",
      });
      invalidateApiCache();
      setSessions([]);
      toast.success(`Cleared ${res.cleared} session(s)`);
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Session clear failed");
    }
  }

  const keyConfigured = !!health?.openRouter?.keyConfigured;
  const pipelineLabel = keyConfigured ? "Live" : t("op.pulse.liveAwaiting");

  const kpis =
    summary && limits && usage
      ? [
          {
            label: t("op.pulse.periodCost"),
            value: `$${(summary.periodPlusLiveUsd ?? summary.periodCostUsd).toFixed(2)}`,
            hint:
              (summary.liveCostUsd || 0) > 0
                ? `$${summary.periodCostUsd.toFixed(2)} ledger · $${Number(summary.liveCostUsd).toFixed(2)} live`
                : (summary.billedCostUsd || 0) > 0
                  ? `$${Number(summary.billedCostUsd).toFixed(2)} OpenRouter billed`
                  : `${summary.periodEntries ?? summary.entries} ledger rows`,
            icon: Coins,
            tone: "amber" as const,
            href: "/dashboard/operator#operations",
            tooltip: t("op.pulse.periodCostHint"),
          },
          {
            label: t("op.pulse.tokenBudget"),
            value: `${tokenPct}%`,
            hint:
              (summary.liveTokens || 0) > 0
                ? `${usage.tokensUsed.toLocaleString()} ledger · +${Number(summary.liveTokens).toLocaleString()} live`
                : `${usage.tokensUsed.toLocaleString()} used`,
            icon: Zap,
            tone: tokenPct > 85 ? ("amber" as const) : ("violet" as const),
            href: "/dashboard/operator#control",
            tooltip: t("op.pulse.tokenBudgetHint"),
          },
          {
            label: t("ws.overview.sessions"),
            value: sessions.length,
            hint: `${runningSessions} active`,
            icon: Bot,
            tone: "teal" as const,
            href: "/dashboard/operator#operations",
            tooltip: t("op.pulse.openOpsSessions"),
          },
          {
            label: t("ws.sources.title"),
            value: sourceCount,
            hint: `${retrievalUrlCount} URLs`,
            icon: Database,
            tone: sourceCount > 0 ? ("teal" as const) : ("default" as const),
            href: "/dashboard/operator#catalog",
            tooltip: t("op.pulse.openCatalog"),
          },
          {
            label: "Reviews",
            value: pendingReviews?.count ?? 0,
            hint: "Pending",
            icon: AlertTriangle,
            tone: (pendingReviews?.count ?? 0) > 0 ? ("amber" as const) : ("default" as const),
            href: "/dashboard/operator#pulse",
            tooltip: t("op.pulse.openPulseReviews"),
          },
          {
            label: "Stored",
            value: storedTotal,
            hint: "Records",
            icon: ShieldCheck,
            tone: "violet" as const,
            href: "/dashboard/operator#moderation",
            tooltip: t("op.pulse.openOpsModeration"),
          },
        ]
      : [];

  const sessionMix = [
    {
      label: "running",
      value: sessions.filter((s) => s.status === "running").length,
      color: "#2DD4BF",
    },
    {
      label: "pending",
      value: sessions.filter((s) => s.status === "pending").length,
      color: "#A855F7",
    },
    {
      label: "done",
      value: sessions.filter((s) => s.status === "completed").length,
      color: "#9AA8C7",
    },
    {
      label: "failed",
      value: sessions.filter((s) => s.status === "failed").length,
      color: "#FF6B5B",
    },
  ];

  const charts = useMemo(() => {
    if (!limits || !summary || !usage || !health) return null;
    return buildOperatorCharts({
      sessionsTotal: sessions.length,
      sessionSegments: sessionMix.map((s) => ({
        name: s.label.charAt(0).toUpperCase() + s.label.slice(1),
        value: s.value,
      })),
      runningSessions,
      agentAvailable: Math.max(0, limits.concurrentAgents - runningSessions),
      tokenPct,
      tokensUsed: usage.tokensUsed,
      tokensPerDay: limits.tokensPerDay,
      concurrentAgents: limits.concurrentAgents,
      periodCostUsd: summary.periodPlusLiveUsd ?? summary.periodCostUsd,
      costSegments: costByModel
        .filter((c) => c.value > 0)
        .map((c) => ({
          name: c.label,
          value: c.value,
        })),
      health,
      pipelineLabel,
      keyConfigured,
      allowPremiumModels: limits.allowPremiumModels,
    });
  }, [
    limits,
    summary,
    usage,
    health,
    sessionMix,
    costByModel,
    runningSessions,
    tokenPct,
    pipelineLabel,
    keyConfigured,
    sessions.length,
  ]);

  const coreReady = !loading && limits && summary && usage && health && charts;

  return (
    <AppShell variant="operator">
      <div
        className={cn(
          "op-page op-page-compact mx-auto space-y-5 p-4 sm:p-6",
          mainTab === "exports" || mainTab === "catalog" || mainTab === "pricing"
            ? "max-w-[1440px]"
            : "max-w-[1280px]"
        )}
      >
        <WorkspacePageHeader
          eyebrow={t("op.pulse.liveConsole")}
          title={t("op.title")}
          description={t("op.subtitle")}
          actions={
            <div className="op-page-actions">
              <Tooltip content={t("op.pulse.reload")}>
                <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={refreshing}>
                  <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                  {t("op.refresh")}
                </Button>
              </Tooltip>
            </div>
          }
        />

        <OperatorMainTabs
          active={mainTab}
          onChange={selectMainTab}
          counts={{
            operations: storedTotal || costs.length + sessions.length,
            catalog: sourceCount,
          }}
        />

        <AnimatePresence mode="wait">
          {mainTab === "exports" && (
            <motion.div
              key="exports"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <OperatorExportTemplatesPanel />
            </motion.div>
          )}

          {mainTab === "pricing" && (
            <motion.div
              key="pricing"
              className="op-tab-panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <OperatorPricingPanel />
            </motion.div>
          )}

          {mainTab === "automation" && (
            <motion.div
              key="automation"
              className="op-tab-panel"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              <OperatorAutomationPanel />
            </motion.div>
          )}

          {mainTab === "catalog" && (
            <motion.div
              key="catalog"
              className="op-tab-panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <OperatorCatalogBoard />
            </motion.div>
          )}

          {mainTab === "debug" && (
            <motion.div
              key="debug"
              id="debug"
              className="op-tab-panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <OperatorDebugPanel />
            </motion.div>
          )}

          {mainTab === "support" && (
            <motion.div
              key="support"
              id="support"
              className="op-tab-panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <OperatorSupportInbox />
            </motion.div>
          )}

          {mainTab === "mail" && (
            <motion.div
              key="mail"
              id="mail"
              className="op-tab-panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <OperatorMailPanel />
            </motion.div>
          )}

          {mainTab === "users" && (
            <motion.div
              key="users"
              id="users"
              className="op-tab-panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <OperatorUsersPanel />
            </motion.div>
          )}

          {(mainTab === "pulse" || mainTab === "control" || mainTab === "operations") &&
            !coreReady && (
              <div key="loading" className="op-tab-panel">
                <Skeleton className="h-[7rem] rounded-[var(--r-lg)]" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-[5.5rem] rounded-[var(--r-md)]" />
                  ))}
                </div>
              </div>
            )}

          {mainTab === "pulse" && coreReady && charts && (
            <motion.div
              key="pulse"
              id="pulse"
              className="op-tab-panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <OperatorPulseBoard
                kpis={kpis}
                charts={charts}
                pendingReviews={pendingReviews}
                onClearStaleReviews={() => {
                  void clearReviews("stale");
                }}
                onClearAllReviews={() => {
                  void clearReviews("all");
                }}
              />
            </motion.div>
          )}

          {mainTab === "control" && coreReady && charts && limits && usage && (
            <motion.div
              key="control"
              id="control"
              className="op-tab-panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <OperatorControlBoard
                limits={limits}
                usage={usage}
                runningSessions={runningSessions}
                saveStatus={limitsSaveStatus}
                onChange={updateLimits}
                onFlush={flushLimitsSave}
                onRetry={() => {
                  void persistLimits();
                }}
                charts={charts}
              />
            </motion.div>
          )}

          {mainTab === "operations" && coreReady && (
            <motion.div
              key="operations"
              id="operations"
              className="op-tab-panel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <OperatorOperationsPanel
                costs={costs}
                sessions={sessions}
                busyId={busyId}
                refreshKey={refreshKey}
                onDelete={deleteStored}
                onChanged={() => void load(true)}
                onClearAllCosts={() => void clearAllCosts()}
                onClearAllSessions={() => void clearAllSessions()}
              />
            </motion.div>
          )}
        </AnimatePresence>

      </div>
      {confirmDialog}
    </AppShell>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  Trash2,
  FolderKanban,
  FileText,
  Activity,
  Mail,
  Bot,
  Coins,
  Search,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Flag,
  EyeOff,
  Eye,
  ScrollText,
  LifeBuoy,
  Info,
  type LucideProps,
} from "lucide-react";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import { OperatorEmptyState } from "@/components/operator/operator-empty-state";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { moderateDelete, moderatePatch } from "@/lib/moderation/client";
import {
  MODERATION_COLLECTIONS,
  MODERATION_LABELS,
  isModerationReadOnly,
  type ModerationCollection,
  type ModerationRow,
} from "@/lib/moderation/constants";
import { cn } from "@/lib/utils";

type InventoryResponse = {
  labels: Record<ModerationCollection, string>;
  counts: Record<ModerationCollection, number>;
  inventory: Record<ModerationCollection, ModerationRow[]>;
};

const TAB_ICONS: Record<ModerationCollection, ComponentType<LucideProps>> = {
  projects: FolderKanban,
  briefs: FileText,
  monitors: Activity,
  "mailing-list": Mail,
  "agent-sessions": Bot,
  costs: Coins,
  audit: ScrollText,
  "support-threads": LifeBuoy,
};

const SINGULAR: Record<ModerationCollection, string> = {
  projects: "project",
  briefs: "brief",
  monitors: "monitor",
  "mailing-list": "subscriber",
  "agent-sessions": "agent session",
  costs: "cost entry",
  audit: "audit entry",
  "support-threads": "support thread",
};

const OPEN_HREF: Partial<Record<ModerationCollection, (id: string) => string>> = {
  projects: (id) => `/dashboard/projects/${id}`,
  briefs: (id) => `/dashboard/briefs/${id}`,
  monitors: (id) => `/dashboard/monitors/${id}`,
};

const PAGE_SIZE = 5;

function parseMetaChips(meta: string): string[] {
  return meta
    .split(/[·|•]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function formatWhen(iso?: string): { label: string; absolute: string } {
  if (!iso) return { label: "—", absolute: "No timestamp" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { label: "—", absolute: iso };
  const absolute = d.toLocaleString();
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return { label: "just now", absolute };
  if (mins < 60) return { label: `${mins}m ago`, absolute };
  const hours = Math.round(mins / 60);
  if (hours < 48) return { label: `${hours}h ago`, absolute };
  const days = Math.round(hours / 24);
  if (days < 14) return { label: `${days}d ago`, absolute };
  return {
    label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    absolute,
  };
}

type Props = {
  onChanged?: () => void;
  refreshKey?: number;
  embedded?: boolean;
};

export function ModerationPanel({ onChanged, refreshKey = 0, embedded = false }: Props) {
  const [tab, setTab] = useState<ModerationCollection>("projects");
  const [data, setData] = useState<InventoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<ModerationRow | null>(null);
  const { ask, dialog: confirmDialog } = useConfirmDialog();
  const readOnly = isModerationReadOnly(tab);

  const load = useCallback(async () => {
    const res = await apiFetch<InventoryResponse>("/api/operator/moderation", {
      skipCache: true,
    });
    setData(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!data) setLoading(true);
    void load().catch((err) => {
      setLoading(false);
      toast.error(err instanceof Error ? err.message : "Failed to load moderation data");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshKey]);

  async function refresh() {
    setRefreshing(true);
    try {
      await load();
      toast.success("Inventory refreshed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function removeRow(row: ModerationRow) {
    if (isModerationReadOnly(row.collection)) {
      toast.info("This collection is read-only");
      return;
    }
    const ok = await ask({
      title: `Delete this ${SINGULAR[row.collection]}?`,
      description: `“${row.title}” will be permanently removed.\n\nThis cannot be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) {
      toast.info("Deletion cancelled");
      return;
    }

    setBusyId(row.id);
    try {
      const res = await moderateDelete(row.collection, row.id);
      toast.success(res.message || "Deleted");
      setDetail(null);
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleFlag(row: ModerationRow, kind: "flagged" | "hidden") {
    if (isModerationReadOnly(row.collection)) return;
    setBusyId(row.id);
    try {
      const next = kind === "flagged" ? !row.flagged : !row.hidden;
      await moderatePatch(row.collection, row.id, { [kind]: next });
      toast.success(kind === "flagged" ? (next ? "Flagged" : "Unflagged") : next ? "Hidden" : "Restored");
      await load();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  const rows = useMemo(() => {
    const all = data?.inventory[tab] ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => `${r.title} ${r.meta} ${r.id}`.toLowerCase().includes(q));
  }, [data, tab, query]);

  useEffect(() => {
    setPage(0);
  }, [tab, query]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  /** Pad to PAGE_SIZE so short pages keep the same panel height / aspect. */
  const pageSlots: (ModerationRow | null)[] = [
    ...pageRows,
    ...Array.from({ length: Math.max(0, PAGE_SIZE - pageRows.length) }, () => null),
  ];
  const rangeStart = rows.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(rows.length, (safePage + 1) * PAGE_SIZE);

  if (loading || !data) {
    return <Skeleton className={embedded ? "m-4 h-56" : "h-72"} />;
  }

  const totalStored = MODERATION_COLLECTIONS.reduce((n, key) => n + data.counts[key], 0);
  const EmptyIcon = TAB_ICONS[tab];
  const CollectionIcon = TAB_ICONS[tab];
  const openHref = OPEN_HREF[tab];

  const body = (
    <>
      <div className={cn("op-mod-toolbar", embedded && "is-embedded")}>
        <Tooltip content={`Browsing ${MODERATION_LABELS[tab].toLowerCase()}`} side="bottom">
          <label className="op-mod-collection">
            <CollectionIcon className="op-mod-collection-icon" aria-hidden />
            <span className="sr-only">Collection</span>
            <Select
              compact
              value={tab}
              onChange={(e) => {
                setTab(e.target.value as ModerationCollection);
                setPage(0);
              }}
              aria-label="Moderation collection"
            >
              {MODERATION_COLLECTIONS.map((key) => (
                <option key={key} value={key}>
                  {data.labels[key]} ({data.counts[key]})
                </option>
              ))}
            </Select>
          </label>
        </Tooltip>
        <div className="op-mod-search">
          <Search aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder={`Search ${MODERATION_LABELS[tab].toLowerCase()}…`}
            aria-label={`Search ${MODERATION_LABELS[tab]}`}
          />
        </div>
        <div className="op-mod-head-tools">
          <Tooltip content={`${totalStored} records across all collections`} side="top">
            <span className="op-mod-total">
              <b>{totalStored}</b>
            </span>
          </Tooltip>
          <Tooltip content="Reload inventory" side="top">
            <button
              type="button"
              className="op-icon-btn"
              disabled={refreshing}
              aria-label="Reload inventory"
              onClick={() => void refresh()}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="op-mod-card-frame">
        {rows.length === 0 ? (
          <div className="op-mod-empty-frame">
            <OperatorEmptyState
              icon={EmptyIcon as import("lucide-react").LucideIcon}
              title={
                query
                  ? `No matches in ${MODERATION_LABELS[tab].toLowerCase()}`
                  : `No ${MODERATION_LABELS[tab].toLowerCase()}`
              }
              description={
                query
                  ? "Try a different search term."
                  : "Records appear here when created in the workspace."
              }
            />
          </div>
        ) : (
          <ul className="op-mod-card-list" role="list">
            {pageSlots.map((row, idx) => {
              if (!row) {
                return <li key={`slot-${safePage}-${idx}`} className="op-mod-card is-slot" aria-hidden />;
              }
              const chips = parseMetaChips(row.meta).slice(0, 4);
              const when = formatWhen(row.createdAt);
              const busy = busyId === row.id;
              const openTo = row.href || (openHref ? openHref(row.id) : undefined);
              return (
                <li
                  key={row.id}
                  className={cn(
                    "op-mod-card",
                    busy && "is-busy",
                    row.flagged && "is-flagged",
                    row.hidden && "is-hidden"
                  )}
                  role="listitem"
                >
                  <div className="op-mod-card-main">
                    <button
                      type="button"
                      className="op-mod-card-title"
                      title={row.title}
                      onClick={() => setDetail(row)}
                    >
                      {row.title}
                    </button>
                    <div className="op-mod-card-meta">
                      {chips.map((chip) => (
                        <span
                          key={chip}
                          className={cn(
                            "op-meta-chip",
                            /active|final|live|completed/i.test(chip) && "is-ok",
                            /paused|draft|pending|flagged/i.test(chip) && "is-warn",
                            /failed|critical|deleted|hidden/i.test(chip) && "is-bad"
                          )}
                        >
                          {chip}
                        </span>
                      ))}
                      <Tooltip content={when.absolute} side="top">
                        <time className="op-mod-when" dateTime={row.createdAt}>
                          {when.label}
                        </time>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="op-mod-actions">
                    <Tooltip content="Details" side="top">
                      <button
                        type="button"
                        className="op-icon-btn op-action-primary"
                        aria-label={`Details ${row.title}`}
                        onClick={() => setDetail(row)}
                      >
                        <Info className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </Tooltip>

                    {openTo ? (
                      <Tooltip content={`Open ${SINGULAR[tab]}`} side="top">
                        <Link
                          href={openTo}
                          className="op-icon-btn is-link"
                          aria-label={`Open ${row.title}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      </Tooltip>
                    ) : null}

                    {!readOnly ? (
                      <>
                        <Tooltip
                          content={row.flagged ? "Clear flag" : "Flag for review"}
                          side="top"
                        >
                          <button
                            type="button"
                            className={cn("op-icon-btn", row.flagged && "is-warn")}
                            disabled={busy}
                            aria-label={`Flag ${row.title}`}
                            onClick={() => void toggleFlag(row, "flagged")}
                          >
                            <Flag className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </Tooltip>
                        <Tooltip
                          content={row.hidden ? "Restore visibility" : "Soft-hide"}
                          side="top"
                        >
                          <button
                            type="button"
                            className="op-icon-btn"
                            disabled={busy}
                            aria-label={`Hide ${row.title}`}
                            onClick={() => void toggleFlag(row, "hidden")}
                          >
                            {row.hidden ? (
                              <Eye className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                        </Tooltip>
                        <Tooltip
                          content={busy ? "Deleting…" : `Delete ${SINGULAR[tab]}`}
                          side="top"
                        >
                          <button
                            type="button"
                            className="op-icon-btn is-danger op-action-primary"
                            disabled={busy}
                            aria-label={`Delete ${row.title}`}
                            onClick={() => void removeRow(row)}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </Tooltip>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="op-mod-pager" role="navigation" aria-label="Moderation pagination">
        <span className="op-mod-pager-meta">
          {rows.length === 0 ? "0 of 0" : `${rangeStart}–${rangeEnd} of ${rows.length}`}
        </span>
        <div className="op-mod-pager-controls">
          <Tooltip content="Previous page" side="top">
            <button
              type="button"
              className="op-icon-btn"
              disabled={rows.length === 0 || safePage <= 0}
              aria-label="Previous page"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            </button>
          </Tooltip>
          <span className="op-mod-pager-page">
            {rows.length === 0 ? "0 / 0" : `${safePage + 1} / ${pageCount}`}
          </span>
          <Tooltip content="Next page" side="top">
            <button
              type="button"
              className="op-icon-btn"
              disabled={rows.length === 0 || safePage >= pageCount - 1}
              aria-label="Next page"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </Tooltip>
        </div>
      </div>
    </>
  );

  const withDrawer = (
    <>
      {body}
      {detail ? (
        <div className="op-mod-drawer" role="dialog" aria-label="Record detail">
          <div className="op-mod-drawer-head">
            <div>
              <p className="op-module-sub">{MODERATION_LABELS[detail.collection]}</p>
              <h4>{detail.title}</h4>
            </div>
            <button type="button" className="op-icon-btn" onClick={() => setDetail(null)} aria-label="Close">
              ×
            </button>
          </div>
          <p className="op-mod-drawer-meta">{detail.meta}</p>
          <p className="op-mod-drawer-id">ID · {detail.id}</p>
          {detail.detail ? (
            <pre className="op-mod-drawer-body op-mod-drawer-pre">{detail.detail}</pre>
          ) : null}
          {detail.href ? (
            <Link href={detail.href} className="text-sm text-teal hover:underline">
              Open in workspace
            </Link>
          ) : null}
        </div>
      ) : null}
      {confirmDialog}
    </>
  );

  if (embedded) return <div className="op-mod-embedded">{withDrawer}</div>;
  return <div className="op-mod-shell">{withDrawer}</div>;
}

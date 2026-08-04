"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Plus,
  Radio,
  Trash2,
} from "lucide-react";
import { MarqueeTrack } from "@/components/chrome/marquee-track";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { notifyWorkspaceRefresh } from "@/lib/workspace-events";
import type { MarqueeItem, MarqueeKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const KINDS: { value: MarqueeKind; label: string; badge: string }[] = [
  { value: "proc", label: "Procurement", badge: "PROCUREMENT" },
  { value: "systems", label: "Systems", badge: "SYSTEMS" },
  { value: "power", label: "Power", badge: "POWER" },
  { value: "narrative", label: "Narrative", badge: "NARRATIVE" },
];

function sortItems(items: MarqueeItem[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

export function OperatorSignalTickerPanel({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<MarqueeItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [badge, setBadge] = useState("PROCUREMENT");
  const [kind, setKind] = useState<MarqueeKind>("proc");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "live" | "hidden">("all");

  const load = useCallback(async () => {
    const data = await apiFetch<{ items: MarqueeItem[] }>("/api/marquee?all=1", {
      skipCache: true,
    });
    setItems(sortItems(data.items));
  }, []);

  useEffect(() => {
    void load()
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load ticker"))
      .finally(() => setInitialLoading(false));
  }, [load]);

  const liveCount = useMemo(() => items.filter((item) => item.enabled).length, [items]);
  const ordered = useMemo(() => sortItems(items), [items]);
  const visibleQueue = useMemo(() => {
    if (filter === "live") return ordered.filter((item) => item.enabled);
    if (filter === "hidden") return ordered.filter((item) => !item.enabled);
    return ordered;
  }, [ordered, filter]);

  const draft =
    text.trim().length >= 4
      ? { badge: badge.trim() || KINDS.find((k) => k.value === kind)?.badge || "SIGNAL", kind, text }
      : null;

  async function syncAfter(next: MarqueeItem[], message: string) {
    setItems(sortItems(next));
    notifyWorkspaceRefresh("marquee");
    toast.success(message);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy("create");
    try {
      const res = await apiFetch<{ item: MarqueeItem }>("/api/marquee", {
        method: "POST",
        json: { badge, kind, text, enabled: true },
      });
      setText("");
      await syncAfter([...items, res.item], "Signal live on ticker");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add signal");
    } finally {
      setBusy(null);
    }
  }

  async function toggle(item: MarqueeItem) {
    const nextEnabled = !item.enabled;
    // Optimistic — preview updates immediately.
    setItems((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, enabled: nextEnabled } : row))
    );
    setBusy(item.id);
    try {
      await apiFetch(`/api/marquee/${item.id}`, {
        method: "PATCH",
        json: { enabled: nextEnabled },
      });
      notifyWorkspaceRefresh("marquee");
      toast.success(nextEnabled ? "Now live on site ticker" : "Hidden from site ticker");
    } catch (err) {
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, enabled: item.enabled } : row))
      );
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(item: MarqueeItem) {
    const snapshot = items;
    setItems((prev) => prev.filter((row) => row.id !== item.id));
    setBusy(item.id);
    try {
      await apiFetch(`/api/marquee/${item.id}`, { method: "DELETE" });
      notifyWorkspaceRefresh("marquee");
      toast.success("Signal removed");
    } catch (err) {
      setItems(snapshot);
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(null);
    }
  }

  async function move(item: MarqueeItem, direction: -1 | 1) {
    const sorted = sortItems(items);
    const index = sorted.findIndex((row) => row.id === item.id);
    const swapWith = index + direction;
    if (index < 0 || swapWith < 0 || swapWith >= sorted.length) return;

    const a = sorted[index];
    const b = sorted[swapWith];
    const nextOrderA = b.sortOrder;
    const nextOrderB = a.sortOrder;
    const optimistic = sorted.map((row) => {
      if (row.id === a.id) return { ...row, sortOrder: nextOrderA };
      if (row.id === b.id) return { ...row, sortOrder: nextOrderB };
      return row;
    });
    setItems(sortItems(optimistic));
    setBusy(item.id);
    try {
      await Promise.all([
        apiFetch(`/api/marquee/${a.id}`, {
          method: "PATCH",
          json: { sortOrder: nextOrderA },
        }),
        apiFetch(`/api/marquee/${b.id}`, {
          method: "PATCH",
          json: { sortOrder: nextOrderB },
        }),
      ]);
      notifyWorkspaceRefresh("marquee");
    } catch (err) {
      setItems(sorted);
      toast.error(err instanceof Error ? err.message : "Reorder failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn("op-ticker", embedded && "is-embedded")} id="ticker">
      <header className="op-ticker-head">
        <div className="op-ticker-head-main">
          <span className="op-ticker-kicker">
            <Radio className="h-3.5 w-3.5" aria-hidden />
            Site marquee
          </span>
          <p className="op-ticker-lede">
            Compose signals that scroll above the navbar. Preview matches the live chrome strip.
          </p>
        </div>
        <div className="op-ticker-stats">
          <StatusBadge tone={liveCount > 0 ? "teal" : "mist"}>
            {liveCount} live
          </StatusBadge>
          <span className="op-ticker-stat-meta">{items.length} total</span>
        </div>
      </header>

      <section className="op-ticker-preview-block" aria-label="Live ticker preview">
        <div className="op-ticker-preview-meta">
          <span>Live preview</span>
          {draft ? <em>includes draft</em> : <em>site chrome parity</em>}
        </div>
        {initialLoading ? (
          <Skeleton className="op-ticker-preview-skel" />
        ) : (
          <MarqueeTrack
            variant="preview"
            items={items}
            draft={draft}
            emptyLabel="No live signals — enable an item or add one below"
          />
        )}
      </section>

      <form className="op-ticker-compose" onSubmit={create}>
        <div className="op-ticker-kinds" role="group" aria-label="Signal category">
          {KINDS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              className={cn("op-ticker-kind", kind === entry.value && "is-active", entry.value)}
              onClick={() => {
                setKind(entry.value);
                setBadge(entry.badge);
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="op-ticker-compose-row">
          <Input
            className="op-ticker-badge"
            value={badge}
            onChange={(e) => setBadge(e.target.value.toUpperCase())}
            placeholder="BADGE"
            aria-label="Badge label"
            required
            maxLength={24}
          />
          <Input
            className="op-ticker-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Headline that will scroll on the site ticker…"
            aria-label="Headline"
            required
            maxLength={240}
          />
          <Button type="submit" size="sm" disabled={busy === "create" || text.trim().length < 4}>
            <Plus className="h-3.5 w-3.5" />
            Publish
          </Button>
        </div>
      </form>

      <section className="op-ticker-queue" aria-label="Ticker queue">
        <div className="op-ticker-queue-head">
          <h3>Queue</h3>
          <div className="op-ticker-filters" role="tablist" aria-label="Filter queue">
            {(
              [
                ["all", "All"],
                ["live", "Live"],
                ["hidden", "Hidden"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                className={cn("op-ticker-filter", filter === id && "is-active")}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {initialLoading ? (
          <Skeleton className="h-28" />
        ) : visibleQueue.length === 0 ? (
          <div className="op-ticker-empty">
            {filter === "all" ? "No signals yet — publish one above." : `No ${filter} signals.`}
          </div>
        ) : (
          <ul className="op-ticker-list" role="list">
            {visibleQueue.map((item) => {
              const absoluteIndex = ordered.findIndex((row) => row.id === item.id);
              return (
                <li
                  key={item.id}
                  className={cn("op-ticker-row", item.enabled ? "is-live" : "is-hidden")}
                >
                  <div className="op-ticker-row-main">
                    <div className="op-ticker-row-top">
                      <span className={cn("tick-tag", item.kind)}>{item.badge}</span>
                      <StatusBadge tone={item.enabled ? "teal" : "mist"}>
                        {item.enabled ? "Live" : "Hidden"}
                      </StatusBadge>
                    </div>
                    <p className="op-ticker-row-text">{item.text}</p>
                  </div>
                  <div className="op-ticker-row-actions">
                    <Tooltip content="Move earlier in scroll" side="top">
                      <button
                        type="button"
                        className="op-icon-btn"
                        disabled={busy === item.id || absoluteIndex <= 0}
                        aria-label="Move up"
                        onClick={() => void move(item, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip content="Move later in scroll" side="top">
                      <button
                        type="button"
                        className="op-icon-btn"
                        disabled={busy === item.id || absoluteIndex >= ordered.length - 1}
                        aria-label="Move down"
                        onClick={() => void move(item, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip content={item.enabled ? "Hide from site" : "Show on site"} side="top">
                      <button
                        type="button"
                        className="op-icon-btn"
                        disabled={busy === item.id}
                        aria-label={item.enabled ? "Hide" : "Show"}
                        onClick={() => void toggle(item)}
                      >
                        {item.enabled ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </Tooltip>
                    <Tooltip content="Remove signal" side="top">
                      <button
                        type="button"
                        className="op-icon-btn is-danger"
                        disabled={busy === item.id}
                        aria-label="Remove"
                        onClick={() => void remove(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

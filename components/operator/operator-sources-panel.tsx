"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Database,
  Eye,
  Globe2,
  HeartPulse,
  Link2,
  ListFilter,
  Radio,
  RefreshCw,
} from "lucide-react";
import { OperatorSection } from "@/components/operator/operator-section";
import { OperatorEmptyState } from "@/components/operator/operator-empty-state";
import { CsvSourceDropzone } from "@/components/sources/csv-dropzone";
import { DeleteAllSourcesButton } from "@/components/sources/delete-all-sources-button";
import { SourceCard } from "@/components/sources/source-card";
import { SourceEditor } from "@/components/sources/source-editor";
import { Button } from "@/components/ui/button";
import { IconSelect } from "@/components/ui/icon-select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import { apiFetch } from "@/lib/api-client";
import { SOURCES_CHANGED_EVENT } from "@/lib/sources/events";
import { toast } from "@/components/ui/toast";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OperatorSourcesPanel({ embedded = false }: { embedded?: boolean }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("all");
  const [watch, setWatch] = useState("all");
  const [retrieval, setRetrieval] = useState("all");
  const [health, setHealth] = useState("all");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Source | null>(null);
  const PAGE_SIZE = 12;

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    try {
      const data = await apiFetch<{ sources: Source[]; count?: number }>("/api/sources", {
        skipCache: soft,
      });
      setSources(data.sources || []);
    } catch {
      toast("Could not load source registry", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onChanged() {
      void load(true);
    }
    window.addEventListener(SOURCES_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(SOURCES_CHANGED_EVENT, onChanged);
  }, [load]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const s of sources) {
      if (s.country) set.add(s.country);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [sources]);

  const countryOptions = useMemo(
    () => [
      {
        value: "all",
        label: "All countries",
        leading: <Globe2 aria-hidden />,
      },
      ...countries.map((c) => ({
        value: c,
        label: c,
        leading: <Globe2 aria-hidden />,
      })),
    ],
    [countries]
  );

  const watchOptions = useMemo(
    () => [
      { value: "all", label: "All watch", leading: <Eye aria-hidden /> },
      { value: "Core", label: "Core", leading: <Eye aria-hidden /> },
      { value: "Secondary", label: "Secondary", leading: <Eye aria-hidden /> },
    ],
    []
  );

  const retrievalOptions = useMemo(
    () => [
      { value: "all", label: "All retrieval", leading: <ListFilter aria-hidden /> },
      { value: "High", label: "High", leading: <ListFilter aria-hidden /> },
      { value: "Medium", label: "Medium", leading: <ListFilter aria-hidden /> },
      { value: "Low", label: "Low", leading: <ListFilter aria-hidden /> },
    ],
    []
  );

  const healthOptions = useMemo(
    () => [
      { value: "all", label: "All health", leading: <HeartPulse aria-hidden /> },
      { value: "healthy", label: "Healthy", leading: <HeartPulse aria-hidden /> },
      { value: "issues", label: "Issues", leading: <Activity aria-hidden /> },
      { value: "never", label: "Unchecked", leading: <Activity aria-hidden /> },
    ],
    []
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sources.filter((s) => {
      if (country !== "all" && s.country !== country) return false;
      if (watch !== "all" && (s.watchPriority || "") !== watch) return false;
      if (retrieval !== "all" && (s.retrievalPriority || "") !== retrieval) return false;
      if (health === "healthy" && (s.health !== "healthy" || !s.healthCheckedAt)) return false;
      if (health === "issues" && !(s.health === "degraded" || s.health === "down")) {
        return false;
      }
      if (health === "never" && s.healthCheckedAt) return false;
      if (!needle) return true;
      const hay = [
        s.title,
        s.type,
        s.institutionOwner,
        s.country,
        ...(s.sectorTags || []),
        ...(s.psnLayers || []),
        s.primaryRetrievalUrl || s.url || "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [sources, q, country, watch, retrieval, health]);

  useEffect(() => {
    setPage(0);
  }, [q, country, watch, retrieval, health]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const stats = useMemo(() => {
    const core = sources.filter((s) => s.watchPriority === "Core").length;
    const withUrl = sources.filter((s) => !!(s.primaryRetrievalUrl || s.url)).length;
    return { total: sources.length, core, withUrl };
  }, [sources]);

  if (loading) {
    return (
      <div className="op-tab-panel space-y-3">
        <Skeleton className="h-16 rounded-[var(--r-md)]" />
        <div className="op-src-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[10px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", !embedded && "op-tab-panel")}>
      <OperatorSection
        id="sources-registry"
        icon={Database}
        title="Source registry"
        description="Click a card to retag and update URLs — edits autosave; delete any CSV row from the card."
        embedded={embedded}
        actions={
          <div className="flex items-center gap-1">
            <DeleteAllSourcesButton
              count={stats.total}
              onCleared={() => void load(true)}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        }
      >
        <div className="op-src-pulse" aria-label="Registry summary">
          <span className="op-src-pulse-chip is-teal">
            <Database className="h-3 w-3" aria-hidden />
            {stats.total} live
          </span>
          <span className="op-src-pulse-chip is-amber">
            <Radio className="h-3 w-3" aria-hidden />
            {stats.core} core
          </span>
          <span className="op-src-pulse-chip is-violet">
            <Link2 className="h-3 w-3" aria-hidden />
            {stats.withUrl} linked
          </span>
        </div>
        <CsvSourceDropzone
          className="mt-2"
          onImported={async () => {
            await load(true);
          }}
        />
      </OperatorSection>

      <div className="op-src-shell">
        <div className="op-src-toolbar">
          <div className="op-src-search">
            <label className="op-src-label" htmlFor="op-src-q">
              Search
            </label>
            <Input
              id="op-src-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, country, tags…"
            />
          </div>
          <div className="op-src-filter">
            <label className="op-src-label" htmlFor="op-src-country">
              Country
            </label>
            <IconSelect
              id="op-src-country"
              aria-label="Country"
              value={country}
              options={countryOptions}
              onChange={setCountry}
            />
          </div>
          <div className="op-src-filter">
            <label className="op-src-label" htmlFor="op-src-watch">
              Watch
            </label>
            <IconSelect
              id="op-src-watch"
              aria-label="Watch"
              value={watch}
              options={watchOptions}
              onChange={setWatch}
            />
          </div>
          <div className="op-src-filter">
            <label className="op-src-label" htmlFor="op-src-retrieval">
              Retrieval
            </label>
            <IconSelect
              id="op-src-retrieval"
              aria-label="Retrieval"
              value={retrieval}
              options={retrievalOptions}
              onChange={setRetrieval}
            />
          </div>
          <div className="op-src-filter">
            <label className="op-src-label" htmlFor="op-src-health">
              Health
            </label>
            <IconSelect
              id="op-src-health"
              aria-label="Health"
              value={health}
              options={healthOptions}
              onChange={setHealth}
            />
          </div>
          <p className="op-src-count">
            {filtered.length}
            <span> / {sources.length}</span>
          </p>
        </div>

        {filtered.length === 0 ? (
          <OperatorEmptyState
            icon={Database}
            title="No matching sources"
            description="Adjust filters or drop a CSV above to merge sources into the registry."
          />
        ) : (
          <>
            <div className="op-src-grid" role="list">
              {pageRows.map((s) => (
                <SourceCard
                  key={s.id}
                  source={s}
                  onEdit={setEditing}
                  onDeleted={(id) => {
                    setSources((prev) => prev.filter((x) => x.id !== id));
                    setEditing((cur) => (cur?.id === id ? null : cur));
                  }}
                />
              ))}
            </div>
            <div className="op-mod-pager op-src-pager">
              <p className="op-mod-pager-meta">
                Showing {safePage * PAGE_SIZE + 1}–
                {Math.min(filtered.length, (safePage + 1) * PAGE_SIZE)} of {filtered.length}
              </p>
              <div className="op-mod-pager-controls">
                <Tooltip content="Previous page" side="top">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={safePage <= 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Prev
                  </Button>
                </Tooltip>
                <span className="op-mod-pager-page">
                  {safePage + 1}/{pageCount}
                </span>
                <Tooltip content="Next page" side="top">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  >
                    Next
                  </Button>
                </Tooltip>
              </div>
            </div>
          </>
        )}
      </div>

      <SourceEditor
        source={editing}
        onClose={() => setEditing(null)}
        onSaved={(next) => {
          setSources((prev) =>
            prev
              .map((s) => (s.id === next.id ? next : s))
              .sort(
                (a, b) =>
                  (b.totalSourceScore ?? 0) - (a.totalSourceScore ?? 0) ||
                  a.title.localeCompare(b.title)
              )
          );
          setEditing((cur) => (cur?.id === next.id ? next : cur));
        }}
        onDeleted={(id) => {
          setSources((prev) => prev.filter((x) => x.id !== id));
          setEditing(null);
        }}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, Radio } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { OperatorEmptyState } from "@/components/operator/operator-empty-state";
import { CsvSourceDropzone } from "@/components/sources/csv-dropzone";
import { DeleteAllSourcesButton } from "@/components/sources/delete-all-sources-button";
import { SourceCard } from "@/components/sources/source-card";
import { SourceEditor } from "@/components/sources/source-editor";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/progress";
import { useT } from "@/components/i18n/locale-provider";
import { apiFetch } from "@/lib/api-client";
import type { Source } from "@/lib/types";

const PAGE_SIZE = 12;

export default function SourcesPage() {
  const t = useT();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Source | null>(null);

  const load = useCallback(async () => {
    const data = await apiFetch<{ sources: Source[] }>("/api/sources", { skipCache: true });
    setSources(data.sources || []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return sources;
    return sources.filter((s) => {
      const hay = [
        s.title,
        s.type,
        s.country,
        s.watchPriority,
        ...(s.sectorTags || []),
        ...(s.psnLayers || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [sources, q]);

  useEffect(() => {
    setPage(0);
  }, [q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(filtered.length, (safePage + 1) * PAGE_SIZE);
  const core = sources.filter((s) => s.watchPriority === "Core").length;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-3 p-4 sm:p-5">
        <div className="ws-page-header">
          <div>
            <p className="ws-eyebrow">{t("ws.section.intelligence")}</p>
            <h1 className="ws-page-title">{t("ws.sources.title")}</h1>
            <p className="ws-page-desc">{t("ws.sources.lede")}</p>
          </div>
          <DeleteAllSourcesButton count={sources.length} onCleared={() => void load()} />
        </div>

        <CsvSourceDropzone onImported={() => void load()} />

        {loading ? (
          <div className="op-src-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-[10px]" />
            ))}
          </div>
        ) : (
          <div className="op-src-shell">
            <div className="op-src-toolbar is-simple">
              <div className="op-src-search">
                <label className="op-src-label" htmlFor="ws-src-q">
                  Search
                </label>
                <Input
                  id="ws-src-q"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("ws.sources.search")}
                />
              </div>
              <div className="op-src-pulse">
                <span className="op-src-pulse-chip is-teal">
                  <Database className="h-3 w-3" aria-hidden />
                  {sources.length}
                </span>
                <span className="op-src-pulse-chip is-amber">
                  <Radio className="h-3 w-3" aria-hidden />
                  {core} core
                </span>
              </div>
              <p className="op-src-count">
                {filtered.length}
                <span> / {sources.length}</span>
              </p>
            </div>

            {filtered.length === 0 ? (
              <OperatorEmptyState
                icon={Database}
                title={t("ws.sources.empty")}
                description={t("ws.sources.emptyHint")}
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
                <div
                  className="ws-pager"
                  role="navigation"
                  aria-label={t("ws.sources.pagination")}
                >
                  <p className="ws-pager-meta">
                    {t("ws.briefs.showing")
                      .replace("{from}", String(rangeStart))
                      .replace("{to}", String(rangeEnd))
                      .replace("{total}", String(filtered.length))}
                  </p>
                  <div className="ws-pager-controls">
                    <button
                      type="button"
                      className="ws-pager-btn"
                      disabled={safePage <= 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      Prev
                    </button>
                    <span className="ws-pager-page">
                      {safePage + 1}/{pageCount}
                    </span>
                    <button
                      type="button"
                      className="ws-pager-btn"
                      disabled={safePage >= pageCount - 1}
                      onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
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
    </AppShell>
  );
}

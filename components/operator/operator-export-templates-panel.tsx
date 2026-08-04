"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileCode2, Plus, Upload } from "lucide-react";
import { OperatorSection } from "@/components/operator/operator-section";
import { ExportTemplateConfigBar } from "@/components/operator/export-template-config-bar";
import { ExportTemplateRail } from "@/components/operator/export-template-rail";
import {
  ExportTemplateWorkspace,
} from "@/components/operator/export-template-workspace";
import { useExportTemplateDraft } from "@/components/operator/use-export-template-draft";
import { useExportTemplatePreview } from "@/components/operator/use-export-template-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingBlur } from "@/components/ui/loading-blur";
import { Skeleton } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { downloadBlob, exportBriefFile } from "@/lib/export/client-export";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import type { ExportFormat, ExportTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatLabel(f: ExportFormat) {
  return f.toUpperCase();
}

const PREVIEW_BRIEF_KEY = "octivate-export-preview-brief";

export function OperatorExportTemplatesPanel() {
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { ask, dialog: confirmDialog } = useConfirmDialog();
  const [dragId, setDragId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [briefId, setBriefId] = useState("");
  const [briefs, setBriefs] = useState<{ id: string; title: string }[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const previewRef = useRef<HTMLIFrameElement>(null);
  const previewRootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectingRef = useRef(false);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  const handleTemplateSaved = useCallback((template: ExportTemplate) => {
    setTemplates((prev) => prev.map((t) => (t.id === template.id ? template : t)));
  }, []);

  const {
    draft,
    updateDraft,
    loadFromTemplate,
    saveStatus,
    isDirty,
    flushSave,
    persistNow,
  } = useExportTemplateDraft(selected, handleTemplateSaved);

  const { previewHtml, previewLoading, previewStale, previewKey, refreshPreview } =
    useExportTemplatePreview(selected, briefId, draft.htmlBody);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.previewText ?? "").toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
    );
  }, [templates, search]);

  const railLabels = useMemo(() => {
    if (!selectedId || !draft.name) return undefined;
    return { [selectedId]: draft.name };
  }, [selectedId, draft.name]);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setInitialLoading(true);
    try {
      const [tplRes, briefRes] = await Promise.all([
        apiFetch<{ templates: ExportTemplate[] }>("/api/operator/export-templates", {
          skipCache: true,
        }),
        apiFetch<{ briefs: { id: string; title: string }[] }>("/api/briefs", { skipCache: true }),
      ]);
      setTemplates(tplRes.templates);
      setBriefs(briefRes.briefs.map((b) => ({ id: b.id, title: b.title })));
      const savedBrief =
        typeof window !== "undefined" ? window.localStorage.getItem(PREVIEW_BRIEF_KEY) : null;
      const validSaved =
        savedBrief && briefRes.briefs.some((b) => b.id === savedBrief) ? savedBrief : null;
      if (validSaved) setBriefId(validSaved);
      else if (briefRes.briefs[0]) setBriefId(briefRes.briefs[0].id);
      setSelectedId((prev) => prev ?? tplRes.templates[0]?.id ?? null);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (briefId) window.localStorage.setItem(PREVIEW_BRIEF_KEY, briefId);
  }, [briefId]);

  useEffect(() => {
    void load().catch(() => setInitialLoading(false));
  }, [load]);

  async function selectTemplate(id: string) {
    if (id === selectedId || selectingRef.current) return;
    selectingRef.current = true;
    try {
      await flushSave();
      setSelectedId(id);
    } finally {
      selectingRef.current = false;
    }
  }

  async function createTemplate() {
    setBusyId("create");
    try {
      await flushSave();
      const data = await apiFetch<{ template: ExportTemplate }>("/api/operator/export-templates", {
        method: "POST",
        json: { name: "New export template" },
      });
      setTemplates((prev) => [...prev, data.template]);
      setSelectedId(data.template.id);
      loadFromTemplate(data.template);
      invalidateApiCache("/api/operator/export-templates");
      toast.success("Template created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusyId(null);
    }
  }

  async function uploadFiles(files: FileList | File[], create = false) {
    const list = Array.from(files);
    if (!list.length) return;
    setBusyId("upload");
    try {
      await flushSave();
      for (const file of list) {
        const form = new FormData();
        form.append("file", file);
        if (create) form.append("create", "1");
        const targetId = create ? "new" : selected?.id;
        if (!targetId && !create) throw new Error("Select a template first");

        const res = await fetch(`/api/operator/export-templates/${targetId ?? "new"}/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${
              process.env.NEXT_PUBLIC_OCTIVATE_API_KEY || "octivate-dev-key"
            }`,
          },
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        if (create || !selected) {
          setTemplates((prev) => {
            const exists = prev.some((t) => t.id === data.template.id);
            return exists
              ? prev.map((t) => (t.id === data.template.id ? data.template : t))
              : [...prev, data.template];
          });
          setSelectedId(data.template.id);
          loadFromTemplate(data.template);
        } else {
          setTemplates((prev) => prev.map((t) => (t.id === data.template.id ? data.template : t)));
          loadFromTemplate(data.template);
        }
      }
      toast.success("Template imported");
      invalidateApiCache("/api/operator/export-templates");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusyId(null);
    }
  }

  async function duplicateTemplate(template: ExportTemplate) {
    setBusyId(template.id);
    try {
      if (selectedId === template.id) await flushSave();
      const data = await apiFetch<{ template: ExportTemplate }>(
        `/api/operator/export-templates/${template.id}/duplicate`,
        { method: "POST" }
      );
      setTemplates((prev) => [...prev, data.template]);
      setSelectedId(data.template.id);
      loadFromTemplate(data.template);
      invalidateApiCache("/api/operator/export-templates");
      toast.success("Template duplicated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Duplicate failed");
    } finally {
      setBusyId(null);
    }
  }

  async function renameTemplate(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    // The selected template is renamed through its draft so autosave owns it.
    if (id === selectedId) {
      updateDraft({ name: trimmed });
      return;
    }
    try {
      const data = await apiFetch<{ template: ExportTemplate }>(
        `/api/operator/export-templates/${id}`,
        { method: "PATCH", json: { name: trimmed } }
      );
      setTemplates((prev) => prev.map((t) => (t.id === id ? data.template : t)));
      invalidateApiCache("/api/operator/export-templates");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rename failed");
    }
  }

  async function removeTemplate(template: ExportTemplate) {
    const ok = await ask({
      title: "Delete this template?",
      description: `“${template.name}” will be permanently removed.\n\nThis cannot be undone.`,
      confirmLabel: "Delete template",
    });
    if (!ok) return;
    setBusyId(template.id);
    try {
      if (selectedId === template.id) await flushSave();
      await apiFetch(`/api/operator/export-templates/${template.id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      if (selectedId === template.id) setSelectedId(null);
      toast.success("Template deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reorderTemplates(nextOrder: string[]) {
    try {
      const data = await apiFetch<{ templates: ExportTemplate[] }>(
        "/api/operator/export-templates",
        { method: "PATCH", json: { order: nextOrder } }
      );
      setTemplates(data.templates);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reorder failed");
    }
  }

  function onDropReorder(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = templates.map((t) => t.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    void reorderTemplates(ids);
    setDragId(null);
  }

  async function runExport(format: ExportFormat) {
    if (!selected || !briefId) {
      toast.error("Select a template and brief");
      return;
    }
    setBusyId(`export-${format}`);
    try {
      await flushSave();
      const { blob, fileName } = await exportBriefFile({
        briefId,
        templateId: selected.id,
        format,
      });
      downloadBlob(blob, fileName);
      toast.success(`${formatLabel(format)} export ready`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusyId(null);
    }
  }

  function handleStudioDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleStudioDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  }

  function handleStudioDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files, !selected);
  }

  const liveCount = templates.filter((t) => t.enabled).length;

  return (
    <div className="op-tab-panel" id="exports">
      <OperatorSection icon={FileCode2} title="Export templates">
        <div className="exp-command-bar">
          <Input
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="exp-command-search"
            aria-label="Search templates"
          />
          <div className="exp-command-actions">
            {!initialLoading && (
              <span className="exp-count-pill">
                {liveCount} live · {templates.length}
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm,.zip"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void uploadFiles(e.target.files, !selected);
                e.target.value = "";
              }}
            />
            <Tooltip content="Import .html, .htm, or .zip" side="bottom">
              <Button
                size="sm"
                variant="ghost"
                disabled={busyId === "upload"}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Import template"
              >
                <Upload className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
            <Tooltip content="Create blank template" side="bottom">
              <Button
                size="sm"
                disabled={busyId === "create"}
                onClick={() => void createTemplate()}
                aria-label="New template"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </OperatorSection>

      {initialLoading ? (
        <Skeleton className="h-48 rounded-[var(--r-lg)]" />
      ) : (
        <LoadingBlur active={refreshing}>
          <div
            className={cn("exp-studio", dragOver && "is-dragover")}
            onDragOver={handleStudioDragOver}
            onDragLeave={handleStudioDragLeave}
            onDrop={handleStudioDrop}
          >
            <div className="exp-studio-upper">
              <aside className="exp-rail">
                <ExportTemplateRail
                  templates={filtered}
                  selectedId={selectedId}
                  busyId={busyId}
                  labelOverrides={railLabels}
                  dirtyId={isDirty ? selectedId : null}
                  onSelect={(id) => void selectTemplate(id)}
                  onDragStart={setDragId}
                  onDragEnd={() => setDragId(null)}
                  onDropReorder={onDropReorder}
                  onDelete={(t) => void removeTemplate(t)}
                  onDuplicate={(t) => void duplicateTemplate(t)}
                  onRename={(id, name) => void renameTemplate(id, name)}
                />
              </aside>

              {selected ? (
                <ExportTemplateConfigBar
                  draft={draft}
                  briefId={briefId}
                  briefs={briefs}
                  saveStatus={saveStatus}
                  onDraftChange={updateDraft}
                  onBriefChange={setBriefId}
                  onManualSave={() => void persistNow(false)}
                  onFieldBlur={() => void flushSave()}
                />
              ) : (
                <div className="exp-config-empty">
                  <p>Select a template or create one.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button size="sm" disabled={busyId === "create"} onClick={() => void createTemplate()}>
                      <Plus className="h-3.5 w-3.5" />
                      New
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === "upload"}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Import
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {selected && (
              <>
                <hr className="exp-studio-divider" aria-hidden />
                <ExportTemplateWorkspace
                  htmlBody={draft.htmlBody}
                  onHtmlChange={(htmlBody) => updateDraft({ htmlBody })}
                  onSourceBlur={() => void flushSave()}
                  templateKey={selected.id}
                  previewHtml={previewHtml}
                  previewLoading={previewLoading}
                  previewStale={previewStale}
                  previewKey={previewKey}
                  previewRef={previewRef}
                  previewRootRef={previewRootRef}
                  onRefreshPreview={() => void refreshPreview()}
                  supportsFormats={draft.supportsFormats}
                  busyId={busyId}
                  sourceSaving={saveStatus === "dirty" || saveStatus === "saving"}
                  onExport={(format) => void runExport(format)}
                />
              </>
            )}
          </div>
        </LoadingBlur>
      )}
      {confirmDialog}
    </div>
  );
}

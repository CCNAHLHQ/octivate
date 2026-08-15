"use client";

import { useEffect, useState } from "react";
import { Download, Eye, FileText, Loader2, Sparkles, Trash2 } from "lucide-react";
import {
  DocumentSummaryModal,
  type DocsFeatureCapabilities,
} from "@/components/dashboard/document-summary-modal";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { notifyWorkspaceRefresh } from "@/lib/workspace-events";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { useT } from "@/components/i18n/locale-provider";
import { toastActionError } from "@/lib/ui/action-feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

const API_KEY =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_OCTIVATE_API_KEY ||
      process.env.OCTIVATE_API_KEY ||
      "octivate-dev-key"
    : "octivate-dev-key";

function formatSize(bytes?: number): string {
  if (bytes == null || bytes <= 0) return "not on disk";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function DocumentLibrary({
  projectId,
  projectName,
  country,
  sector,
  documents,
  disabled = false,
  onChanged,
}: {
  projectId: string;
  projectName?: string;
  country?: string;
  sector?: string;
  documents: Project["documents"];
  disabled?: boolean;
  onChanged: (project: Project) => void;
}) {
  const t = useT();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"compose" | "view">("compose");
  const [summarizing, setSummarizing] = useState(false);
  const [caps, setCaps] = useState<DocsFeatureCapabilities>({
    enabled: true,
    model: "deepseek/deepseek-v4-flash",
    allowFocus: true,
    allowRework: true,
  });
  const { ask, dialog: confirmDialog } = useConfirmDialog();

  const activeDoc = documents.find((d) => d.id === activeId) || null;

  useEffect(() => {
    void apiFetch<DocsFeatureCapabilities>("/api/docs/feature-config", { skipCache: true })
      .then((res) =>
        setCaps({
          enabled: res.enabled !== false,
          model: res.model || "deepseek/deepseek-v4-flash",
          allowFocus: res.allowFocus !== false,
          allowRework: res.allowRework !== false,
        })
      )
      .catch(() => undefined);
  }, []);

  async function downloadDoc(doc: Project["documents"][number]) {
    setBusyId(doc.id);
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/${doc.id}`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || t("ws.docs.downloadFailed"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name || "document";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toastActionError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteDoc(doc: Project["documents"][number]) {
    const ok = await ask({
      title: t("ws.docs.deleteConfirm"),
      description: `“${doc.name}” will be permanently removed from this project. This cannot be undone.`,
      confirmLabel: t("ws.docs.delete"),
    });
    if (!ok) return;
    setBusyId(doc.id);
    try {
      const data = await apiFetch<{ project: Project }>(
        `/api/projects/${projectId}/documents/${doc.id}`,
        { method: "DELETE" }
      );
      invalidateApiCache("/api/projects");
      notifyWorkspaceRefresh(["projects"]);
      onChanged(data.project);
      if (activeId === doc.id) setActiveId(null);
      toast.success(t("ws.docs.deleted"));
    } catch (err) {
      toastActionError(err);
    } finally {
      setBusyId(null);
    }
  }

  function openCompose(doc: Project["documents"][number]) {
    setActiveId(doc.id);
    setModalMode("compose");
  }

  function openView(doc: Project["documents"][number]) {
    setActiveId(doc.id);
    setModalMode("view");
  }

  async function generateSummary(focus: string) {
    if (!activeDoc) return;
    setSummarizing(true);
    setBusyId(activeDoc.id);
    try {
      const data = await apiFetch<{ project: Project }>(
        `/api/projects/${projectId}/documents/${activeDoc.id}/summarize`,
        {
          method: "POST",
          json: { focus: focus || undefined },
        }
      );
      invalidateApiCache("/api/projects");
      notifyWorkspaceRefresh(["projects"]);
      onChanged(data.project);
      setModalMode("view");
      toast.success(focus ? t("ws.docs.reworkReady") : t("ws.docs.summaryReady"));
    } catch (err) {
      toastActionError(err);
    } finally {
      setSummarizing(false);
      setBusyId(null);
    }
  }

  if (!documents.length) {
    return <p className="text-sm text-mist">{t("ws.docs.noUploads")}</p>;
  }

  return (
    <>
      <ul className="ws-doc-list mb-3">
        {documents.map((d) => {
          const busy = busyId === d.id || (summarizing && activeId === d.id);
          const hasSummary = Boolean(d.summary);
          return (
            <li key={d.id} className="ws-doc-item">
              <div className="ws-doc-row">
                <span className="ws-doc-icon" aria-hidden>
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </span>
                <div className="ws-doc-meta">
                  <button
                    type="button"
                    className="ws-doc-name"
                    title={hasSummary ? t("ws.docs.openSummary") : d.name}
                    disabled={!hasSummary}
                    onClick={() => openView(d)}
                  >
                    {d.name}
                  </button>
                  <span className="ws-doc-sub">
                    {formatSize(d.size)}
                    {d.expiresAt
                      ? ` · expires ${new Date(d.expiresAt).toLocaleDateString()}`
                      : ""}
                    {d.summaryStatus === "ready" ? " · summarized" : ""}
                    {d.summaryStatus === "failed" ? " · summary failed" : ""}
                    {d.summaryStatus === "running" || busy ? " · summarizing…" : ""}
                  </span>
                </div>
                <StatusBadge>{d.type}</StatusBadge>
                <div className="ws-doc-actions">
                  {hasSummary ? (
                    <button
                      type="button"
                      className="ws-doc-btn"
                      disabled={disabled || busy}
                      title={t("ws.docs.readSummary")}
                      aria-label={`${t("ws.docs.readSummary")} ${d.name}`}
                      onClick={() => openView(d)}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                  {caps.enabled && (!hasSummary || caps.allowRework) ? (
                    <button
                      type="button"
                      className="ws-doc-btn"
                      disabled={disabled || busy}
                      title={hasSummary ? t("ws.docs.rework") : t("ws.docs.summarize")}
                      aria-label={
                        hasSummary
                          ? `${t("ws.docs.rework")} ${d.name}`
                          : `${t("ws.docs.summarize")} ${d.name}`
                      }
                      onClick={() => openCompose(d)}
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="ws-doc-btn"
                    disabled={disabled || busy}
                    title="Download"
                    aria-label={`Download ${d.name}`}
                    onClick={() => downloadDoc(d)}
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={cn("ws-doc-btn", "is-danger")}
                    disabled={disabled || busy}
                    title="Delete"
                    aria-label={`Delete ${d.name}`}
                    onClick={() => deleteDoc(d)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <DocumentSummaryModal
        open={Boolean(activeDoc)}
        mode={modalMode}
        document={activeDoc}
        projectName={projectName}
        country={country}
        sector={sector}
        running={summarizing}
        capabilities={caps}
        onClose={() => {
          if (summarizing) return;
          setActiveId(null);
        }}
        onSwitchMode={setModalMode}
        onGenerate={generateSummary}
      />
      {confirmDialog}
    </>
  );
}

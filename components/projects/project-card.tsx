"use client";

import { useEffect, useId, useState, type FormEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowUpRight,
  FileText,
  Globe,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  CountrySelect,
  SectorSelect,
} from "@/components/projects/country-sector-fields";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { useT } from "@/components/i18n/locale-provider";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { countryFlagUrl, resolveCountryOption } from "@/lib/geo/countries";
import { notifyWorkspaceRefresh } from "@/lib/workspace-events";
import { useMounted } from "@/lib/use-mounted";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatRelative(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type Props = {
  project: Project;
  onUpdated?: (project: Project) => void;
  onDeleted?: (id: string) => void;
};

export function ProjectCard({ project, onUpdated, onDeleted }: Props) {
  const t = useT();
  const mounted = useMounted();
  const editTitleId = useId();
  const hasQuestion = Boolean(project.question?.trim());
  const isActive = project.status === "active";
  const country = resolveCountryOption(project.country);
  const flagSrc = country ? countryFlagUrl(country.code, 20) : "";

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editCountry, setEditCountry] = useState(project.country);
  const [editSector, setEditSector] = useState(project.sector);

  useEffect(() => {
    if (!editOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setEditOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [editOpen, busy]);

  function openEdit(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditName(project.name);
    setEditCountry(project.country);
    setEditSector(project.sector);
    setEditOpen(true);
  }

  function openDelete(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeleteOpen(true);
  }

  function closeEdit() {
    if (!busy) setEditOpen(false);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const name = editName.trim();
    if (!name || !editCountry || !editSector) return;
    setBusy(true);
    try {
      const data = await apiFetch<{ project: Project }>(`/api/projects/${project.id}`, {
        method: "PATCH",
        json: { name, country: editCountry, sector: editSector },
        skipCache: true,
      });
      invalidateApiCache("/api/projects");
      notifyWorkspaceRefresh(["projects", "overview"]);
      toast.success(t("ws.projects.updated"));
      setEditOpen(false);
      onUpdated?.(data.project);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("ws.projects.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function runDelete() {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${project.id}`, {
        method: "DELETE",
        skipCache: true,
      });
      invalidateApiCache("/api/projects");
      invalidateApiCache("/api/briefs");
      notifyWorkspaceRefresh(["projects", "overview", "briefs"]);
      toast.success(t("ws.projects.deleted"));
      setDeleteOpen(false);
      onDeleted?.(project.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("ws.projects.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  const editModal =
    mounted && editOpen
      ? createPortal(
          <div className="ws-project-edit-root" role="presentation">
            <button
              type="button"
              className="ws-project-edit-backdrop"
              aria-label="Close"
              disabled={busy}
              onClick={closeEdit}
            />
            <div
              className="ws-project-edit-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby={editTitleId}
            >
              <h3 id={editTitleId} className="ws-project-edit-title">
                {t("ws.projects.edit")}
              </h3>
              <form onSubmit={saveEdit} className="ws-project-edit-form">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  placeholder={t("ws.projects.name")}
                  disabled={busy}
                  autoFocus
                />
                <CountrySelect
                  value={editCountry}
                  onChange={setEditCountry}
                  required
                  disabled={busy}
                />
                <SectorSelect
                  value={editSector}
                  onChange={setEditSector}
                  required
                  disabled={busy}
                />
                <div className="ws-project-edit-actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={closeEdit}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={busy || !editName.trim() || !editCountry || !editSector}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        Saving…
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <article className="ws-project-card">
        <div className="ws-project-card-inner">
          <div className="ws-project-card-top">
            <Link
              href={`/dashboard/projects/${project.id}`}
              className="ws-project-card-title-link"
            >
              <h3 className="ws-project-card-title">{project.name}</h3>
            </Link>
            <div className="ws-project-card-top-right">
              <span className={cn("ws-status-chip", isActive ? "is-active" : "is-archived")}>
                {isActive ? "Active" : "Archived"}
              </span>
              <div
                className="ws-project-card-icon-actions"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Tooltip content={t("ws.projects.edit")} side="top">
                  <button
                    type="button"
                    className="ws-icon-btn"
                    aria-label={`${t("ws.projects.edit")} ${project.name}`}
                    onClick={openEdit}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </Tooltip>
                <Tooltip content={t("ws.projects.delete")} side="top">
                  <button
                    type="button"
                    className="ws-icon-btn is-danger"
                    aria-label={`${t("ws.projects.delete")} ${project.name}`}
                    onClick={openDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>

          <Link
            href={`/dashboard/projects/${project.id}`}
            className="ws-project-card-body-link"
          >
            <p className="ws-card-meta">
              {flagSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={flagSrc}
                  alt=""
                  width={16}
                  height={12}
                  className="ws-country-flag"
                  loading="lazy"
                />
              ) : (
                <Globe className="ws-card-meta-ico" aria-hidden />
              )}
              {project.country}
              <span className="ws-card-meta-sep" aria-hidden>
                ·
              </span>
              {project.sector}
            </p>
            <p className="ws-card-body line-clamp-2">
              {hasQuestion
                ? project.question
                : "No strategic question yet — open to run the agent workflow."}
            </p>
          </Link>

          <div className="ws-project-card-foot">
            <div className="ws-project-card-stats">
              <span>
                <FileText className="h-3.5 w-3.5" aria-hidden />
                {project.documents.length}{" "}
                {project.documents.length === 1 ? "doc" : "docs"}
              </span>
              <span>Updated {formatRelative(project.updatedAt)}</span>
            </div>
            <div className="ws-project-card-actions">
              {hasQuestion ? (
                <span className="ws-chip ws-chip-violet">Question ready</span>
              ) : (
                <span className="ws-chip ws-chip-mist">Needs question</span>
              )}
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="ws-card-cta"
              >
                Open
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </article>

      {editModal}

      <ConfirmDialog
        open={deleteOpen}
        busy={busy}
        busyLabel="Deleting…"
        title={t("ws.projects.deleteConfirmTitle")}
        description={`Remove “${project.name}” permanently. ${t("ws.projects.deleteConfirmBody")}`}
        confirmLabel={t("ws.projects.delete")}
        onCancel={() => {
          if (!busy) setDeleteOpen(false);
        }}
        onConfirm={() => void runDelete()}
      />
    </>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="ws-project-card-inner animate-pulse">
      <div className="h-5 w-2/3 rounded bg-white/10" />
      <div className="mt-2 h-3 w-1/2 rounded bg-white/5" />
      <div className="mt-4 h-10 w-full rounded bg-white/5" />
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  Pencil,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { SourceHealthPulse } from "@/components/sources/source-health-pulse";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { countryFlagUrl, resolveSourceCountry } from "@/lib/geo/countries";
import { notifySourcesChanged } from "@/lib/sources/events";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

function retrievalUrl(s: Source): string {
  return s.primaryRetrievalUrl || s.url || "";
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 42);
  }
}

type Props = {
  source: Source;
  onEdit?: (source: Source) => void;
  onDeleted?: (id: string) => void;
  /** Show per-source delete (CSV registry row). Default true when onDeleted provided. */
  canDelete?: boolean;
};

export function SourceCard({
  source: s,
  onEdit,
  onDeleted,
  canDelete,
}: Props) {
  const primary = retrievalUrl(s);
  const pubs = s.dataPublicationsUrl || "";
  const countryLabel = s.country || s.countries?.[0] || "";
  const country = resolveSourceCountry(countryLabel);
  const flagSrc = country ? countryFlagUrl(country.code, 20) : "";
  const tags = (s.sectorTags || []).slice(0, 3);
  const showDelete = canDelete ?? Boolean(onDeleted);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasParl =
    s.id.startsWith("parl_") ||
    Boolean(s.lastCaptureRoutes?.includes("parliamentary-video"));
  const hasCapture =
    Boolean(s.lastCaptureAt || s.lastCaptureFolder) && !hasParl;
  const localBadges = [
    hasCapture ? "capture" : null,
    hasParl ? "parl transcript" : null,
  ].filter(Boolean) as string[];

  async function runDelete() {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch(`/api/sources/${s.id}`, {
        method: "DELETE",
        skipCache: true,
      });
      invalidateApiCache("/api/sources");
      notifySourcesChanged();
      toast.success(`Deleted “${s.title}”`);
      setConfirmOpen(false);
      onDeleted?.(s.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={cn("op-src-card", onEdit && "is-editable")}
      role="listitem"
      onClick={onEdit ? () => onEdit(s) : undefined}
      onKeyDown={
        onEdit
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onEdit(s);
              }
            }
          : undefined
      }
      tabIndex={onEdit ? 0 : undefined}
    >
      <header className="op-src-card-head">
        <div className="op-src-card-titles">
          <div className="op-src-card-title-row">
            <SourceHealthPulse source={s} />
            <h3 className="op-src-card-title" title={s.title}>
              {s.title}
            </h3>
          </div>
          <p className="op-src-card-meta">
            {countryLabel ? (
              <span className="op-src-country">
                {flagSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={flagSrc}
                    alt=""
                    width={14}
                    height={10}
                    className="ws-country-flag"
                    loading="lazy"
                  />
                ) : (
                  <Globe className="op-src-flag-fallback" aria-hidden />
                )}
                <span>{countryLabel}</span>
              </span>
            ) : null}
            {s.type ? (
              <>
                <span className="op-src-dot" aria-hidden />
                <span>{s.type}</span>
              </>
            ) : null}
          </p>
        </div>
        <div
          className="op-src-card-actions"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {onEdit ? (
            <Tooltip content="Edit tags & URLs" side="top">
              <button
                type="button"
                className="ws-icon-btn"
                aria-label={`Edit ${s.title}`}
                onClick={() => onEdit(s)}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </button>
            </Tooltip>
          ) : null}
          {showDelete ? (
            <Tooltip content="Delete source" side="top">
              <button
                type="button"
                className="ws-icon-btn is-danger"
                aria-label={`Delete ${s.title}`}
                disabled={busy}
                onClick={() => setConfirmOpen(true)}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </Tooltip>
          ) : null}
          {primary ? (
            <Tooltip content={`Open ${hostLabel(primary)}`} side="top">
              <a
                href={primary}
                target="_blank"
                rel="noreferrer"
                className="ws-icon-btn is-link"
                aria-label={`Open ${s.title}`}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </Tooltip>
          ) : null}
          {pubs ? (
            <Tooltip content="Publications" side="top">
              <a
                href={pubs}
                target="_blank"
                rel="noreferrer"
                className="ws-icon-btn"
                aria-label={`Publications for ${s.title}`}
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden />
              </a>
            </Tooltip>
          ) : null}
        </div>
      </header>

      {tags.length ? (
        <div className="op-src-card-tags">
          {tags.map((t) => (
            <span key={t} className="op-src-mini-tag">
              {t}
            </span>
          ))}
          {(s.sectorTags?.length || 0) > tags.length ? (
            <span className="op-src-mini-tag is-more">
              +{(s.sectorTags?.length || 0) - tags.length}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="op-src-card-status">
        {s.watchPriority ? (
          <span
            className={cn(
              "op-src-status-item",
              s.watchPriority === "Core" && "is-core"
            )}
          >
            {s.watchPriority}
          </span>
        ) : null}
        {s.retrievalPriority ? (
          <span className="op-src-status-item">{s.retrievalPriority}</span>
        ) : null}
        {s.totalSourceScore != null ? (
          <span className="op-src-status-item">Σ {s.totalSourceScore}</span>
        ) : null}
        {localBadges.map((b) => (
          <span key={b} className="op-src-status-item is-local" title="Local evidence available">
            {b}
          </span>
        ))}
        {s.humanReviewRequired ? (
          <span className="op-src-status-review">
            <ShieldAlert className="h-3 w-3" aria-hidden />
            Review
          </span>
        ) : null}
      </div>

      <p className={cn("op-src-card-url", !primary && "is-empty")}>
        {primary ? hostLabel(primary) : "No retrieval URL"}
      </p>

      <ConfirmDialog
        open={confirmOpen}
        busy={busy}
        busyLabel="Deleting…"
        title="Delete this source?"
        description={`Remove “${s.title}” from the live registry. This cannot be undone.`}
        confirmLabel="Delete source"
        onCancel={() => {
          if (!busy) setConfirmOpen(false);
        }}
        onConfirm={() => void runDelete()}
      />
    </article>
  );
}

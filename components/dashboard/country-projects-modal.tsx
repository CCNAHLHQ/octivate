"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowUpRight, FolderKanban, X } from "lucide-react";
import { useT } from "@/components/i18n/locale-provider";
import { countryFlagUrl } from "@/lib/geo/countries";
import type { CountryProjectBucket } from "@/lib/geo/aggregate-projects";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  bucket: CountryProjectBucket | null;
  onClose: () => void;
};

export function CountryProjectsModal({ open, bucket, onClose }: Props) {
  const t = useT();
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open || !bucket) return null;

  const flag = countryFlagUrl(bucket.code, 40);

  return createPortal(
    <div className="ws-doc-modal-root" role="presentation">
      <button
        type="button"
        className="ws-doc-modal-backdrop"
        aria-label={t("ws.overview.map.close")}
        onClick={onClose}
      />
      <div
        className="ws-doc-modal-panel overview-map-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="ws-doc-modal-head">
          <div className="overview-map-modal-head-main">
            {flag ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={flag} alt="" className="overview-map-modal-flag" width={28} height={20} />
            ) : (
              <span className="overview-map-modal-flag is-empty" aria-hidden>
                <FolderKanban className="h-4 w-4" />
              </span>
            )}
            <div>
              <p className="ws-doc-modal-kicker">{t("ws.overview.map.modalKicker")}</p>
              <h2 id={titleId} className="ws-doc-modal-title">
                {bucket.name}
              </h2>
              <p className="overview-map-modal-meta">
                {t("ws.overview.map.projectCount")
                  .replace("{n}", String(bucket.count))
                  .replace("{active}", String(bucket.active))}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="overview-map-modal-close"
            onClick={onClose}
            aria-label={t("ws.overview.map.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="ws-doc-modal-body">
          <div className="ws-doc-modal-scroll overview-map-modal-list">
            {bucket.projects.length === 0 ? (
              <p className="ws-doc-modal-p">{t("ws.overview.map.emptyCountry")}</p>
            ) : (
              <ul>
                {bucket.projects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/dashboard/projects/${p.id}`}
                      className={cn(
                        "overview-map-modal-link",
                        p.status === "archived" && "is-archived"
                      )}
                      onClick={onClose}
                    >
                      <span className="overview-map-modal-link-copy">
                        <strong>{p.name}</strong>
                        <em>
                          {p.sector}
                          {p.status === "archived" ? ` · ${t("ws.projects.filter.archived")}` : ""}
                        </em>
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

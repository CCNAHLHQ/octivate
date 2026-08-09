"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/dashboard/app-shell";
import { OctivateLogoMark } from "@/components/brand/octivate-logo-mark";
import { StakeholdersGallery } from "@/components/stakeholders/stakeholders-gallery";
import { Skeleton } from "@/components/ui/progress";
import { useT } from "@/components/i18n/locale-provider";
import { apiFetch } from "@/lib/api-client";
import type { Stakeholder } from "@/lib/types";
import "./stakeholders.css";

export default function StakeholdersPage() {
  const t = useT();
  const [rows, setRows] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<{ stakeholders: Stakeholder[] }>("/api/stakeholders", {
          skipCache: true,
        });
        setRows(data.stakeholders || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppShell>
      <div className="sth-page">
        <div className="sth-page-inner">
          <header className="sth-hero">
            <OctivateLogoMark className="sth-hero-brand" style={{ width: 44, height: 38 }} />
            <p className="sth-hero-eyebrow">{t("ws.stakeholders.cause")}</p>
            <h1 className="sth-hero-title">{t("ws.stakeholders.title")}</h1>
            <p className="sth-hero-lede">{t("ws.stakeholders.lede")}</p>
          </header>

          {loading ? (
            <Skeleton className="h-56 rounded-none bg-transparent" />
          ) : (
            <StakeholdersGallery stakeholders={rows} />
          )}
        </div>
      </div>
    </AppShell>
  );
}

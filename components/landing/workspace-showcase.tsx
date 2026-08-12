"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, LayoutDashboard, MapPinned } from "lucide-react";
import { useT } from "@/components/i18n/locale-provider";
import { SEED_BRIEFS, SEED_PROJECTS, SEED_TRENDS } from "@/lib/mock/seed";
import { aggregateProjectsByCountry, type CountryProjectBucket } from "@/lib/geo/aggregate-projects";
import {
  LazyConfidenceGauge,
  LazyDistBars,
  LazyDonutChart,
} from "@/components/ui/lazy-charts";
import { StatusBadge, severityTone } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const CountryLeafletMap = dynamic(
  () =>
    import("@/components/dashboard/country-leaflet-map").then((m) => m.CountryLeafletMap),
  {
    ssr: false,
    loading: () => <Skeleton className="land-ws-map-skeleton" />,
  }
);

type Tab = "insights" | "coverage";

export function WorkspaceShowcase() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("insights");
  const [selected, setSelected] = useState<CountryProjectBucket | null>(null);

  const buckets = useMemo(() => aggregateProjectsByCountry(SEED_PROJECTS), []);
  const avgConfidence = useMemo(() => {
    if (!SEED_BRIEFS.length) return 0;
    return Math.round(
      SEED_BRIEFS.reduce((s, b) => s + b.confidence, 0) / SEED_BRIEFS.length
    );
  }, []);

  const riskItems = useMemo(() => {
    const levels = ["critical", "high", "medium", "low"] as const;
    const colors: Record<(typeof levels)[number], string> = {
      critical: "#ed6d6c",
      high: "#f59e0b",
      medium: "#4d9df7",
      low: "#2dd4bf",
    };
    return levels.map((level) => ({
      label: level,
      value: SEED_BRIEFS.filter((b) => b.riskLevel === level).length,
      color: colors[level],
    }));
  }, []);

  const briefSegments = useMemo(() => {
    const final = SEED_BRIEFS.filter((b) => b.status === "final").length;
    const draft = SEED_BRIEFS.length - final;
    return [
      { name: t("land.ws.briefsFinal"), value: final },
      { name: t("land.ws.briefsDraft"), value: Math.max(draft, 0) },
    ];
  }, [t]);

  const trends = SEED_TRENDS.slice(0, 4);

  return (
    <section className="section land-ws" id="workspace" aria-labelledby="land-ws-heading">
      <div className="container">
        <div className="section-head land-ws-head reveal">
          <span className="eyebrow">{t("land.ws.eyebrow")}</span>
          <h2 id="land-ws-heading">{t("land.ws.title")}</h2>
          <p className="lede">{t("land.ws.lede")}</p>
        </div>

        <div className="land-ws-frame reveal">
          <div className="land-ws-chrome">
            <div className="land-ws-dots" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <p className="land-ws-chrome-label">{t("land.ws.chromeLabel")}</p>
            <div className="land-ws-tabs" role="tablist" aria-label={t("land.ws.tabsLabel")}>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "insights"}
                className={cn("land-ws-tab", tab === "insights" && "is-active")}
                onClick={() => setTab("insights")}
              >
                <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
                {t("land.ws.tabInsights")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "coverage"}
                className={cn("land-ws-tab", tab === "coverage" && "is-active")}
                onClick={() => setTab("coverage")}
              >
                <MapPinned className="h-3.5 w-3.5" aria-hidden />
                {t("land.ws.tabCoverage")}
              </button>
            </div>
          </div>

          <div className="land-ws-body" role="tabpanel">
            {tab === "insights" ? (
              <div className="land-ws-insights">
                <div className="land-ws-stat-grid">
                  <div className="land-ws-card">
                    <p className="land-ws-card-title">{t("land.ws.riskMix")}</p>
                    <LazyDistBars items={riskItems} heightClass="h-[11rem]" />
                  </div>
                  <div className="land-ws-card">
                    <p className="land-ws-card-title">{t("land.ws.avgConfidence")}</p>
                    <LazyConfidenceGauge value={avgConfidence} />
                  </div>
                  <div className="land-ws-card">
                    <p className="land-ws-card-title">{t("land.ws.briefs")}</p>
                    <LazyDonutChart
                      segments={briefSegments}
                      centerLabel={String(SEED_BRIEFS.length)}
                    />
                  </div>
                </div>

                <div className="land-ws-split">
                  <div className="land-ws-card">
                    <p className="land-ws-card-title">{t("land.ws.trends")}</p>
                    <ul className="land-ws-trends">
                      {trends.map((tr) => (
                        <li key={tr.id}>
                          <div className="land-ws-trend-copy">
                            <strong>{tr.title}</strong>
                            <span>
                              {tr.country} · {tr.sector}
                            </span>
                          </div>
                          <StatusBadge tone={severityTone(tr.severity)}>{tr.severity}</StatusBadge>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="land-ws-card">
                    <p className="land-ws-card-title">{t("land.ws.recentBriefs")}</p>
                    <div className="land-ws-table-wrap">
                      <table className="land-ws-table">
                        <thead>
                          <tr>
                            <th>{t("land.ws.colBrief")}</th>
                            <th>{t("land.ws.colCountry")}</th>
                            <th>{t("land.ws.colRisk")}</th>
                            <th>{t("land.ws.colConfidence")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {SEED_BRIEFS.map((b) => (
                            <tr key={b.id}>
                              <td>{b.title}</td>
                              <td>{b.country}</td>
                              <td>
                                <StatusBadge tone={severityTone(b.riskLevel)}>
                                  {b.riskLevel}
                                </StatusBadge>
                              </td>
                              <td className="land-ws-conf">{b.confidence}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="land-ws-coverage">
                <div className="land-ws-map-panel">
                  <CountryLeafletMap
                    buckets={buckets}
                    onSelect={(bucket) => setSelected(bucket)}
                  />
                </div>
                <aside className="land-ws-side">
                  <p className="land-ws-card-title">{t("land.ws.coverageSide")}</p>
                  {selected ? (
                    <div className="land-ws-selected">
                      <strong>{selected.name}</strong>
                      <span>
                        {t("land.ws.coverageStats")
                          .replace("{n}", String(selected.count))
                          .replace("{active}", String(selected.active))}
                      </span>
                      <ul>
                        {selected.projects.map((p) => (
                          <li key={p.id}>
                            <em>{p.name}</em>
                            <span>{p.sector}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="land-ws-side-hint">{t("land.ws.coverageHint")}</p>
                  )}
                </aside>
              </div>
            )}
          </div>
        </div>

        <div className="land-ws-cta reveal">
          <Link className="land-ws-cta-link" href="/sample/brief">
            {t("land.ws.ctaSample")}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

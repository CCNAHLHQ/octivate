"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { LocateFixed, RefreshCw, Zap } from "lucide-react";
import { useT } from "@/components/i18n/locale-provider";
import type { CountryProjectBucket } from "@/lib/geo/aggregate-projects";
import { useWorkspaceRefresh } from "@/lib/hooks/use-workspace-refresh";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/progress";

const CountryLeafletMap = dynamic(
  () =>
    import("@/components/dashboard/country-leaflet-map").then(
      (m) => m.CountryLeafletMap
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="overview-map-leaflet-skeleton" />,
  }
);

type Props = {
  buckets: CountryProjectBucket[];
  refreshing?: boolean;
  onSelect: (bucket: CountryProjectBucket) => void;
  /** Soft-reload projects from the live workspace bus / poll. */
  onLiveRefresh?: () => void | Promise<void>;
};

export function CountryActivityMap({
  buckets,
  refreshing = false,
  onSelect,
  onLiveRefresh,
}: Props) {
  const t = useT();
  const [lightning, setLightning] = useState(false);
  const [liveFlash, setLiveFlash] = useState(0);
  const [resetToken, setResetToken] = useState(0);

  const totalProjects = useMemo(
    () => buckets.reduce((s, b) => s + b.count, 0),
    [buckets]
  );

  const bucketSig = useMemo(
    () => buckets.map((b) => `${b.code}:${b.count}`).join("|"),
    [buckets]
  );

  useEffect(() => {
    if (!refreshing && !liveFlash) return;
    setLightning(true);
    const id = window.setTimeout(() => setLightning(false), 900);
    return () => window.clearTimeout(id);
  }, [refreshing, liveFlash, bucketSig]);

  useWorkspaceRefresh(() => {
    setLiveFlash((n) => n + 1);
  }, ["overview", "projects", "all"]);

  useEffect(() => {
    if (!onLiveRefresh) return;
    const id = window.setInterval(() => {
      // Pause polling while workspace/operator tutorial is open — avoids map "refresh" glitches.
      if (document.documentElement.dataset.workspaceTour === "1") return;
      void onLiveRefresh();
    }, 12_000);
    return () => window.clearInterval(id);
  }, [onLiveRefresh]);

  return (
    <section
      className={cn(
        "overview-map-band",
        refreshing && "is-refreshing",
        lightning && "is-lightning"
      )}
      aria-label={t("ws.overview.map.title")}
      data-tour="overview-map"
    >
      <div className="overview-map-band-head">
        <div>
          <h2 className="overview-map-title">{t("ws.overview.map.title")}</h2>
          <p className="overview-map-lede">{t("ws.overview.map.lede")}</p>
        </div>
        <div className="overview-map-head-meta">
          <div className="overview-map-head-actions">
            <button
              type="button"
              className="overview-map-reset"
              onClick={() => setResetToken((n) => n + 1)}
              title={t("ws.overview.map.resetHint")}
            >
              <LocateFixed className="h-3 w-3" aria-hidden />
              {t("ws.overview.map.reset")}
            </button>
            <span
              className={cn(
                "overview-map-live",
                (refreshing || lightning) && "is-on",
                refreshing && "is-updating"
              )}
              title={
                refreshing
                  ? t("ws.overview.map.updatingHint")
                  : t("ws.overview.map.liveHint")
              }
            >
              {refreshing ? (
                <RefreshCw className="h-3 w-3 overview-map-live-spin" aria-hidden />
              ) : (
                <Zap className="h-3 w-3" aria-hidden />
              )}
              {refreshing ? t("ws.overview.map.updating") : t("ws.overview.map.live")}
            </span>
          </div>
          <p className="overview-map-stat">
            {t("ws.overview.map.summary")
              .replace("{countries}", String(buckets.length))
              .replace("{projects}", String(totalProjects))}
          </p>
        </div>
      </div>

      <div className="overview-map-canvas-wrap">
        <CountryLeafletMap
          buckets={buckets}
          lightning={lightning}
          resetToken={resetToken}
          onSelect={onSelect}
        />

        {buckets.length === 0 ? (
          <div className="overview-map-empty">
            <p>{t("ws.overview.map.empty")}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { LatLngExpression, LatLngTuple } from "leaflet";
import { useT } from "@/components/i18n/locale-provider";
import { useTheme } from "@/components/theme/theme-provider";
import type { CountryProjectBucket } from "@/lib/geo/aggregate-projects";
import "leaflet/dist/leaflet.css";

type Props = {
  buckets: CountryProjectBucket[];
  lightning?: boolean;
  /** Increment to re-center on the Caribbean basin. */
  resetToken?: number;
  onSelect: (bucket: CountryProjectBucket) => void;
};

export const CARIBBEAN_CENTER: LatLngTuple = [15.2, -66.5];
export const CARIBBEAN_ZOOM = 4.4;

const TILE = {
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
} as const;

function FitMarkers({ points }: { points: LatLngTuple[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) {
      map.setView(CARIBBEAN_CENTER, CARIBBEAN_ZOOM);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 6);
      return;
    }
    map.fitBounds(points, { padding: [36, 36], maxZoom: 7 });
  }, [map, points]);
  return null;
}

function CaribbeanReset({ token }: { token: number }) {
  const map = useMap();
  useEffect(() => {
    if (!token) return;
    map.setView(CARIBBEAN_CENTER, CARIBBEAN_ZOOM, { animate: true, duration: 0.55 });
  }, [map, token]);
  return null;
}

function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => map.invalidateSize({ pan: false });
    const id = window.setTimeout(invalidate, 80);
    const id2 = window.setTimeout(invalidate, 320);
    window.addEventListener("resize", invalidate);

    const root = map.getContainer().parentElement;
    let ro: ResizeObserver | null = null;
    if (root && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => invalidate());
      ro.observe(root);
    }

    return () => {
      window.clearTimeout(id);
      window.clearTimeout(id2);
      window.removeEventListener("resize", invalidate);
      ro?.disconnect();
    };
  }, [map]);
  return null;
}

export function CountryLeafletMap({
  buckets,
  lightning = false,
  resetToken = 0,
  onSelect,
}: Props) {
  const t = useT();
  const { theme } = useTheme();
  const tile = theme === "dark" ? TILE.dark : TILE.light;
  const max = Math.max(1, ...buckets.map((b) => b.count));

  const points = useMemo(
    () => buckets.map((b) => [b.lat, b.lon] as LatLngTuple),
    [buckets]
  );

  return (
    <MapContainer
      className="overview-leaflet-map"
      center={CARIBBEAN_CENTER as LatLngExpression}
      zoom={CARIBBEAN_ZOOM}
      scrollWheelZoom={false}
      attributionControl
      zoomControl
    >
      <TileLayer
        key={theme}
        attribution={tile.attribution}
        url={tile.url}
        subdomains="abcd"
        maxZoom={18}
      />
      <InvalidateOnMount />
      <FitMarkers points={points} />
      <CaribbeanReset token={resetToken} />

      {buckets.map((bucket) => {
        const intensity = bucket.count / max;
        const radius = 4.5 + intensity * 5;
        return (
          <CircleMarker
            key={bucket.code}
            center={[bucket.lat, bucket.lon]}
            radius={radius}
            pathOptions={{
              color: "#6b3ad4",
              fillColor: "#14b8a6",
              fillOpacity: 0.88,
              opacity: 1,
              weight: 2.25,
              className: lightning
                ? "overview-map-marker-path is-lightning"
                : "overview-map-marker-path",
            }}
            eventHandlers={{
              click: () => onSelect(bucket),
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={0.96}>
              <div className="overview-map-leaflet-tip">
                <strong>{bucket.name}</strong>
                <span>
                  {t("ws.overview.map.hoverStats")
                    .replace("{n}", String(bucket.count))
                    .replace("{active}", String(bucket.active))}
                </span>
                <em>{t("ws.overview.map.clickHint")}</em>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

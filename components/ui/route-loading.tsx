"use client";

import { useT } from "@/components/i18n/locale-provider";
import { BrandLogoLoading } from "@/components/ui/brand-logo-loading";

export function RouteLoading({
  label,
  labelKey = "ws.loading.workspace",
}: {
  label?: string;
  labelKey?: string;
}) {
  const t = useT();
  const text = label ?? t(labelKey);
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <BrandLogoLoading label={text} />
      <div className="route-loading-grid" aria-hidden>
        <div className="route-loading-card" />
        <div className="route-loading-card" />
        <div className="route-loading-card" />
        <div className="route-loading-card" />
      </div>
    </div>
  );
}

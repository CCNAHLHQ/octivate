"use client";

import { useT } from "@/components/i18n/locale-provider";

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
      <p className="font-mono text-[10px] uppercase tracking-widest text-faint mb-4">{text}</p>
      <div className="route-loading-grid">
        <div className="route-loading-card" />
        <div className="route-loading-card" />
        <div className="route-loading-card" />
        <div className="route-loading-card" />
      </div>
    </div>
  );
}

"use client";

import { OctivateLogoMark } from "@/components/brand/octivate-logo-mark";
import { cn } from "@/lib/utils";

export function BrandLogoLoading({
  label = "Loading",
  className,
  compact = false,
}: {
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn("brand-logo-loading", compact && "is-compact", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="brand-logo-loading-orb" aria-hidden>
        <OctivateLogoMark decorative className="brand-logo-loading-mark" />
      </span>
      <p className="brand-logo-loading-label">{label}</p>
    </div>
  );
}

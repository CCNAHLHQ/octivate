"use client";

import { OctivateLogo } from "@/components/brand";

export function LoginTransition({
  active,
  leaving,
}: {
  active: boolean;
  leaving: boolean;
}) {
  return (
    <div
      className={`auth-transition${active ? " is-active" : ""}${leaving ? " is-leaving" : ""}`}
      aria-hidden={!active}
      role="status"
    >
      <div className="auth-transition-glass" />
      <div className="auth-transition-mark">
        <div className="auth-transition-pulse">
          <OctivateLogo variant="mark" height={56} decorative />
        </div>
        <p className="auth-transition-label">Opening workspace</p>
      </div>
    </div>
  );
}

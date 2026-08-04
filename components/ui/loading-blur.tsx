"use client";

import { cn } from "@/lib/utils";

export function LoadingBlur({
  active,
  children,
  className,
  label = "Updating…",
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn("ws-loading-blur", active && "is-active", className)}
      aria-busy={active}
    >
      {children}
      {active ? (
        <div className="ws-loading-blur-veil" aria-hidden>
          <span className="ws-loading-blur-pill">{label}</span>
        </div>
      ) : null}
    </div>
  );
}

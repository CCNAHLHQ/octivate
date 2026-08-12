"use client";

import { cn } from "@/lib/utils";

/**
 * Soft-refresh wrapper. Keeps content interactive and unblurred —
 * callers surface status in-place (e.g. map Live badge).
 */
export function LoadingBlur({
  active,
  children,
  className,
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
  /** @deprecated Status is shown by children; label is ignored. */
  label?: string;
}) {
  return (
    <div
      className={cn("ws-loading-blur", active && "is-active", className)}
      aria-busy={active}
      data-updating={active ? "true" : undefined}
    >
      {children}
    </div>
  );
}

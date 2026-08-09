"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { useT } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

export type AutosaveStatus = "saved" | "saving" | "dirty" | "error";

export const CONTROL_AUTOSAVE_MS = 650;

export function AutosaveStatusPill({
  status,
  onRetry,
  className,
}: {
  status: AutosaveStatus;
  onRetry?: () => void;
  className?: string;
}) {
  const t = useT();
  const copy: Record<AutosaveStatus, { label: string; tooltip: string }> = {
    saved: { label: "Saved", tooltip: t("op.autosave.saved") },
    saving: { label: "Saving", tooltip: t("op.autosave.writing") },
    dirty: { label: t("op.autosave.soon"), tooltip: t("op.autosave.pending") },
    error: { label: t("op.autosave.failed"), tooltip: t("op.autosave.retry") },
  };
  const current = copy[status];
  const clickable = status === "error" && !!onRetry;

  return (
    <Tooltip content={current.tooltip} side="bottom">
      <button
        type="button"
        className={cn(
          "op-autosave-status",
          status === "saved" && "is-saved",
          status === "dirty" && "is-dirty",
          status === "error" && "is-error",
          className
        )}
        disabled={!clickable}
        onClick={() => {
          if (clickable) onRetry();
        }}
        aria-live="polite"
      >
        {status === "saving" ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> {current.label}
          </>
        ) : status === "error" ? (
          <>
            <AlertCircle className="h-3 w-3" aria-hidden /> {current.label}
          </>
        ) : status === "dirty" ? (
          <>
            <span className="op-autosave-dot" aria-hidden /> {current.label}
          </>
        ) : (
          <>
            <Check className="h-3 w-3" aria-hidden /> {current.label}
          </>
        )}
      </button>
    </Tooltip>
  );
}

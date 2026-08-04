"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type AutosaveStatus = "saved" | "saving" | "dirty" | "error";

const COPY: Record<AutosaveStatus, { label: string; tooltip: string }> = {
  saved: { label: "Saved", tooltip: "All changes saved" },
  saving: { label: "Saving", tooltip: "Writing changes…" },
  dirty: { label: "Saving soon", tooltip: "Edits pending — autosaves shortly" },
  error: { label: "Save failed", tooltip: "Last save failed — click to retry" },
};

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
  const copy = COPY[status];
  const clickable = status === "error" && !!onRetry;

  return (
    <Tooltip content={copy.tooltip} side="bottom">
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
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> {copy.label}
          </>
        ) : status === "error" ? (
          <>
            <AlertCircle className="h-3 w-3" aria-hidden /> {copy.label}
          </>
        ) : status === "dirty" ? (
          <>
            <span className="op-autosave-dot" aria-hidden /> {copy.label}
          </>
        ) : (
          <>
            <Check className="h-3 w-3" aria-hidden /> {copy.label}
          </>
        )}
      </button>
    </Tooltip>
  );
}

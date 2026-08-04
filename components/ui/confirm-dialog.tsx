"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { Trash2, X } from "lucide-react";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  busyLabel?: string;
  tone?: "danger" | "neutral";
  icon?: LucideIcon;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  busyLabel,
  tone = "danger",
  icon: Icon = Trash2,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const mounted = useMounted();
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Always allow Escape / dismiss so long jobs never trap the operator in a modal.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="ui-confirm-root" role="presentation">
      <button
        type="button"
        className="ui-confirm-backdrop"
        aria-label="Dismiss"
        onClick={onCancel}
      />
      <div
        className="ui-confirm-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <button
          type="button"
          className="ui-confirm-close"
          aria-label="Close"
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
        </button>
        <div
          className={cn("ui-confirm-icon", tone === "neutral" && "is-neutral")}
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </div>
        <h3 id={titleId}>{title}</h3>
        <p id={descId}>{description}</p>
        {busy ? (
          <p className="ui-confirm-busy-hint">
            {busyLabel || "Working…"} — you can close this and watch progress on the card.
          </p>
        ) : null}
        <div className="ui-confirm-actions">
          <button type="button" className="ui-confirm-btn" onClick={onCancel}>
            {busy ? "Close" : cancelLabel}
          </button>
          <button
            type="button"
            className={cn("ui-confirm-btn", tone === "danger" && "is-danger")}
            disabled={busy}
            onClick={onConfirm}
          >
            <Icon className="h-4 w-4" />
            {busy ? busyLabel || "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export type AskConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "neutral";
  icon?: LucideIcon;
};

/**
 * Promise-based confirm for replacing window.confirm.
 * Renders `{dialog}` next to your tree; await `ask(...)`.
 */
export function useConfirmDialog() {
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const [opts, setOpts] = useState<AskConfirmOptions | null>(null);

  const ask = useCallback((next: AskConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolver.current?.(false);
      resolver.current = resolve;
      setOpts(next);
    });
  }, []);

  const close = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  }, []);

  const dialog: ReactNode = (
    <ConfirmDialog
      open={Boolean(opts)}
      title={opts?.title || ""}
      description={opts?.description || ""}
      confirmLabel={opts?.confirmLabel}
      cancelLabel={opts?.cancelLabel}
      tone={opts?.tone}
      icon={opts?.icon}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    />
  );

  return { ask, dialog };
}

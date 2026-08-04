"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info" | "warning";

export type ToastOptions = {
  /** Override auto-dismiss lifetime. Errors default longer so operators can read them. */
  durationMs?: number;
  /** Skip coalesce into an existing same-tone toast. */
  forceNew?: boolean;
  /** Secondary line (e.g. date · time). */
  meta?: string;
  /** Navigate on toast body click. */
  href?: string;
  /** Custom body click handler (runs before href). */
  onClick?: () => void;
};

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
  createdAt: number;
  durationMs: number;
  meta?: string;
  href?: string;
  onClick?: () => void;
};

type ToastPayload = {
  message: unknown;
  tone: ToastTone;
  durationMs?: number;
  forceNew?: boolean;
  meta?: string;
  href?: string;
  onClick?: () => void;
};

type ToastListener = (item: ToastPayload) => void;

const listeners = new Set<ToastListener>();
let seq = 0;

/** Max toasts shown at once — overflow is concatenated into the stack, not dropped. */
export const TOAST_MAX_VISIBLE = 4;
/** Soft character budget for a single toast body. */
export const TOAST_MAX_CHARS = 240;
/** Max discrete parts joined into one toast before "+N more". */
export const TOAST_MAX_PARTS = 6;
/** Same-tone messages within this window merge instead of stacking. */
export const TOAST_COALESCE_MS = 1600;

const DEFAULT_DURATION = 4200;
/** Pipeline / API failures — long enough to read and act. */
export const TOAST_ERROR_DURATION_MS = 16_000;
export const TOAST_WARNING_DURATION_MS = 12_000;

const TONE_DEFAULT_MS: Record<ToastTone, number> = {
  success: DEFAULT_DURATION,
  info: 5500,
  warning: TOAST_WARNING_DURATION_MS,
  error: TOAST_ERROR_DURATION_MS,
};

const PART_SEP = " · ";

function cleanPart(raw: unknown): string {
  if (raw == null || raw === false) return "";
  if (typeof raw === "string") return raw.replace(/\s+/g, " ").trim();
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (raw instanceof Error) return cleanPart(raw.message || raw.name);
  if (Array.isArray(raw)) return concatToastParts(raw);
  if (typeof raw === "object") {
    const rec = raw as { message?: unknown; error?: unknown; errors?: unknown };
    if (typeof rec.message === "string") return cleanPart(rec.message);
    if (typeof rec.error === "string") return cleanPart(rec.error);
    if (Array.isArray(rec.errors)) return concatToastParts(rec.errors);
    try {
      return cleanPart(JSON.stringify(raw));
    } catch {
      return "";
    }
  }
  return String(raw).replace(/\s+/g, " ").trim();
}

/**
 * Join many toast fragments, cap how many are shown, and soft-truncate the result.
 * Overflowing parts are summarized as "+N more" rather than dropped silently.
 */
export function concatToastParts(
  parts: readonly unknown[],
  opts?: { maxChars?: number; maxParts?: number; sep?: string }
): string {
  const maxChars = opts?.maxChars ?? TOAST_MAX_CHARS;
  const maxParts = opts?.maxParts ?? TOAST_MAX_PARTS;
  const sep = opts?.sep ?? PART_SEP;

  const cleaned: string[] = [];
  for (const part of parts) {
    const text = cleanPart(part);
    if (!text) continue;
    if (cleaned.some((c) => c === text)) continue;
    cleaned.push(text);
  }
  if (!cleaned.length) return "";

  const shown = cleaned.slice(0, maxParts);
  const overflow = cleaned.length - shown.length;
  let body = shown.join(sep);
  if (overflow > 0) {
    const suffix = `${sep}+${overflow} more`;
    body = truncateToastText(body, Math.max(24, maxChars - suffix.length)) + suffix;
    return body;
  }
  return truncateToastText(body, maxChars);
}

/** Truncate a single string at a word boundary when possible. */
export function truncateToastText(text: string, maxChars = TOAST_MAX_CHARS): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  const budget = Math.max(16, maxChars - 1);
  const slice = normalized.slice(0, budget);
  const breakAt = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf(PART_SEP.trim()));
  const cut = breakAt > budget * 0.55 ? slice.slice(0, breakAt) : slice;
  return `${cut.replace(/[·\s]+$/g, "").trimEnd()}…`;
}

/** Normalize any toast input (string, list, Error, etc.) into display text. */
export function formatToastMessage(input: unknown): string {
  if (Array.isArray(input)) return concatToastParts(input);
  return truncateToastText(cleanPart(input));
}

function mergeToastMessages(existing: string, incoming: string): string {
  return concatToastParts([existing, incoming]);
}

type ToastFn = {
  (message: unknown, tone?: ToastTone, opts?: ToastOptions): void;
  success: (message: unknown, opts?: ToastOptions) => void;
  error: (message: unknown, opts?: ToastOptions) => void;
  info: (message: unknown, opts?: ToastOptions) => void;
  warning: (message: unknown, opts?: ToastOptions) => void;
  /** Explicit multi-part helper — concatenates with overflow limiting. */
  parts: (
    parts: readonly unknown[],
    tone?: ToastTone,
    opts?: ToastOptions
  ) => void;
};

/** Imperative toast — works from any client component site-wide. */
export const toast: ToastFn = (
  message: unknown,
  tone: ToastTone = "success",
  opts?: ToastOptions
): void => {
  const durationMs = opts?.durationMs ?? TONE_DEFAULT_MS[tone] ?? DEFAULT_DURATION;
  const payload: ToastPayload = {
    message,
    tone,
    durationMs,
    forceNew: opts?.forceNew,
    meta: opts?.meta,
    href: opts?.href,
    onClick: opts?.onClick,
  };
  listeners.forEach((fn) => fn(payload));
};

toast.success = (message, opts) => toast(message, "success", opts);
toast.error = (message, opts) => toast(message, "error", opts);
toast.info = (message, opts) => toast(message, "info", opts);
toast.warning = (message, opts) => toast(message, "warning", opts);
toast.parts = (parts, tone = "info", opts) =>
  toast(concatToastParts(parts), tone, opts);

const TONE_DOT: Record<ToastTone, string> = {
  success: "bg-[var(--tide)] shadow-[0_0_10px_var(--glow-t)]",
  error: "bg-[var(--coral)] shadow-[0_0_10px_rgba(255,107,91,0.55)]",
  info: "bg-[var(--violet)] shadow-[0_0_10px_var(--glow-v)]",
  warning: "bg-[var(--amber)] shadow-[0_0_10px_rgba(245,158,11,0.45)]",
};

function ToastCountdown({
  createdAt,
  durationMs,
}: {
  createdAt: number;
  durationMs: number;
}) {
  const [progress, setProgress] = useState(1);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - createdAt;
      const next = Math.max(0, 1 - elapsed / durationMs);
      setProgress(next);
      if (next > 0) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [createdAt, durationMs]);

  const r = 9;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - progress);

  return (
    <svg className="toast-countdown" viewBox="0 0 24 24" aria-hidden>
      <circle className="toast-countdown-track" cx="12" cy="12" r={r} />
      <circle
        className="toast-countdown-progress"
        cx="12"
        cy="12"
        r={r}
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

/**
 * Mount once in SiteChrome. Renders the fixed toast stack for the whole app.
 */
export function Toaster({ durationMs = DEFAULT_DURATION }: { durationMs?: number }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, number>>(new Map());
  const itemsRef = useRef<ToastItem[]>([]);

  const commitItems = useCallback((next: ToastItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      const t = timers.current.get(id);
      if (t) {
        window.clearTimeout(t);
        timers.current.delete(id);
      }
      commitItems(itemsRef.current.filter((item) => item.id !== id));
    },
    [commitItems]
  );

  const armTimer = useCallback(
    (id: number, life: number) => {
      const existing = timers.current.get(id);
      if (existing) window.clearTimeout(existing);
      const timer = window.setTimeout(() => dismiss(id), life);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  const push = useCallback(
    (item: ToastPayload) => {
      const message = formatToastMessage(item.message);
      if (!message) return;

      const life = item.durationMs ?? durationMs;
      const now = Date.now();
      const current = itemsRef.current;

      // Coalesce into newest same-tone toast when firing rapidly.
      if (!item.forceNew && current.length) {
        const newest = current[current.length - 1];
        if (
          newest.tone === item.tone &&
          now - newest.createdAt <= TOAST_COALESCE_MS &&
          !item.href &&
          !item.onClick &&
          !newest.href &&
          !newest.onClick
        ) {
          const merged = mergeToastMessages(newest.message, message);
          if (merged !== newest.message) {
            commitItems(
              current.map((row) =>
                row.id === newest.id
                  ? {
                      ...row,
                      message: merged,
                      meta: item.meta || row.meta,
                      createdAt: now,
                      durationMs: life,
                    }
                  : row
              )
            );
          }
          armTimer(newest.id, life);
          return;
        }
      }

      const id = ++seq;
      const next: ToastItem = {
        id,
        message,
        tone: item.tone,
        createdAt: now,
        durationMs: life,
        meta: item.meta,
        href: item.href,
        onClick: item.onClick,
      };

      if (current.length < TOAST_MAX_VISIBLE) {
        commitItems([...current, next]);
      } else {
        // Stack overflow: fold the oldest toast(s) into the new one instead of dropping.
        const overflowCount = current.length - (TOAST_MAX_VISIBLE - 1);
        const overflow = current.slice(0, overflowCount);
        const kept = current.slice(overflowCount);
        overflow.forEach((row) => {
          const t = timers.current.get(row.id);
          if (t) {
            window.clearTimeout(t);
            timers.current.delete(row.id);
          }
        });
        const folded = concatToastParts(
          [...overflow.map((row) => row.message), next.message],
          { maxParts: TOAST_MAX_PARTS, maxChars: TOAST_MAX_CHARS }
        );
        commitItems([...kept, { ...next, message: folded || next.message }]);
      }

      armTimer(id, life);
    },
    [armTimer, commitItems, durationMs]
  );

  useEffect(() => {
    listeners.add(push);
    return () => {
      listeners.delete(push);
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
    };
  }, [push]);

  if (items.length === 0) return null;

  function activate(item: ToastItem) {
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      try {
        window.location.assign(item.href);
      } catch {
        /* ignore */
      }
    }
    dismiss(item.id);
  }

  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      {items.map((item) => {
        const actionable = Boolean(item.href || item.onClick);
        return (
          <div
            key={item.id}
            className={cn(
              "toast show",
              item.tone === "error" && "is-error",
              item.tone === "info" && "is-info",
              item.tone === "warning" && "is-warning",
              actionable && "is-action"
            )}
            role={actionable ? "button" : "status"}
            tabIndex={actionable ? 0 : undefined}
            title={
              actionable
                ? `${item.message}${item.meta ? ` · ${item.meta}` : ""} · Open`
                : item.message
            }
            onClick={actionable ? () => activate(item) : undefined}
            onKeyDown={
              actionable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      activate(item);
                    }
                  }
                : undefined
            }
          >
            <span className={cn("t-dot", TONE_DOT[item.tone])} aria-hidden />
            <span className="toast-msg">
              <span className="toast-msg-text">{item.message}</span>
              {item.meta ? <span className="toast-msg-meta">{item.meta}</span> : null}
              {actionable ? (
                <span className="toast-msg-hint">Click to open chat</span>
              ) : null}
            </span>
            <ToastCountdown createdAt={item.createdAt} durationMs={item.durationMs} />
            <button
              type="button"
              className="toast-dismiss"
              aria-label="Dismiss notification"
              title="Dismiss"
              onClick={(e) => {
                e.stopPropagation();
                dismiss(item.id);
              }}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Optional wrapper if a tree needs an explicit provider boundary. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}

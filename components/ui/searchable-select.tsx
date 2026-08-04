"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchableOption = {
  value: string;
  label: string;
  keywords?: string[];
  leading?: ReactNode;
};

type PanelCoords = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  side: "top" | "bottom";
};

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  required,
  disabled,
  className,
  emptyLabel = "No matches",
}: {
  value: string;
  onChange: (next: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  emptyLabel?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<PanelCoords | null>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        o.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  }, [options, query]);

  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const gap = 4;
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.max(r.width, 140);
    const spaceBelow = vh - r.bottom - pad;
    const spaceAbove = r.top - pad;
    const preferBelow = spaceBelow >= 132 || spaceBelow >= spaceAbove;
    const maxHeight = Math.min(200, Math.max(88, preferBelow ? spaceBelow - gap : spaceAbove - gap));
    const side: "top" | "bottom" = preferBelow ? "bottom" : "top";
    let left = r.left;
    left = Math.min(Math.max(pad, left), vw - width - pad);

    const measured = panelRef.current?.getBoundingClientRect().height || 0;
    const panelH = measured > 0 ? Math.min(measured, maxHeight) : maxHeight;
    const top =
      side === "bottom"
        ? r.bottom + gap
        : Math.max(pad, r.top - gap - panelH);

    setCoords({ top, left, width, maxHeight, side });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, place, filtered.length, query]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const panel =
    mounted && open ? (
      createPortal(
        <div
          ref={panelRef}
          className={cn(
            "ws-search-select-panel is-portal",
            coords?.side === "top" && "is-above",
            coords && "is-placed"
          )}
          role="listbox"
          id={listId}
          style={
            coords
              ? {
                  top: coords.top,
                  left: coords.left,
                  width: coords.width,
                  maxHeight: coords.maxHeight,
                }
              : { top: -9999, left: -9999, visibility: "hidden" }
          }
        >
          <label className="ws-search-select-search">
            <Search className="h-3 w-3 shrink-0" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
            />
          </label>
          <div className="ws-search-select-list">
            {filtered.map((opt) => {
              const on = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={cn("ws-search-select-option", on && "is-selected")}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  {opt.leading}
                  <span className="ws-search-select-option-label">{opt.label}</span>
                  {on ? <Check className="h-3 w-3 ml-auto shrink-0 opacity-80" aria-hidden /> : null}
                </button>
              );
            })}
            {!filtered.length ? <p className="ws-search-select-empty">{emptyLabel}</p> : null}
          </div>
        </div>,
        document.body
      )
    ) : null;

  return (
    <div ref={rootRef} className={cn("ws-search-select", open && "is-open", className)}>
      <button
        ref={triggerRef}
        type="button"
        className="ws-search-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
          setQuery("");
        }}
      >
        <span className="ws-search-select-value">
          {selected?.leading}
          <span className={!selected ? "is-placeholder" : undefined}>
            {selected?.label || placeholder}
          </span>
        </span>
        <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-55" aria-hidden />
      </button>
      <input tabIndex={-1} className="sr-only" value={value} required={required} readOnly />
      {panel}
    </div>
  );
}

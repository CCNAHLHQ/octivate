"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type IconSelectOption = {
  value: string;
  label: string;
  leading?: ReactNode;
};

type PanelCoords = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  side: "top" | "bottom";
};

export function IconSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  options: IconSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<PanelCoords | null>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const gap = 4;
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.max(r.width, 168);
    const spaceBelow = vh - r.bottom - pad;
    const spaceAbove = r.top - pad;
    const preferBelow = spaceBelow >= 140 || spaceBelow >= spaceAbove;
    const maxHeight = Math.min(240, Math.max(96, preferBelow ? spaceBelow - gap : spaceAbove - gap));
    const side: "top" | "bottom" = preferBelow ? "bottom" : "top";
    let left = r.left;
    left = Math.min(Math.max(pad, left), vw - width - pad);
    const measured = panelRef.current?.getBoundingClientRect().height || 0;
    const panelH = measured > 0 ? Math.min(measured, maxHeight) : maxHeight;
    const top =
      side === "bottom" ? r.bottom + gap : Math.max(pad, r.top - gap - panelH);
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
  }, [open, place, options.length]);

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
            "ui-icon-select-panel",
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
          <div className="ui-icon-select-list">
            {options.map((opt) => {
              const on = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={cn("ui-icon-select-option", on && "is-selected")}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span className="ui-icon-select-leading" aria-hidden>
                    {opt.leading}
                  </span>
                  <span className="ui-icon-select-option-label">{opt.label}</span>
                  {on ? (
                    <Check className="h-3.5 w-3.5 ml-auto shrink-0 opacity-80" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )
    ) : null;

  return (
    <div
      ref={rootRef}
      className={cn("ui-icon-select", open && "is-open", className)}
      id={id}
    >
      <button
        ref={triggerRef}
        type="button"
        className="ui-icon-select-trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
      >
        <span className="ui-icon-select-value">
          {selected?.leading ? (
            <span className="ui-icon-select-leading" aria-hidden>
              {selected.leading}
            </span>
          ) : null}
          <span className={!selected ? "is-placeholder" : undefined}>
            {selected?.label || placeholder}
          </span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-55" aria-hidden />
      </button>
      {panel}
    </div>
  );
}

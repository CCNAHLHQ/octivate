"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SmoothSelectOption = {
  value: string;
  label: string;
  /** Leading glyph (e.g. country flag) */
  prefix?: ReactNode;
};

export function SmoothSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  className,
  error,
  menuClassName,
  maxMenuHeight = 220,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SmoothSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
  menuClassName?: string;
  maxMenuHeight?: number;
  "aria-label"?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"down" | "up">("down");
  const [menuMax, setMenuMax] = useState(maxMenuHeight);
  const selected = options.find((o) => o.value === value);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const pad = 12;
    const spaceBelow = window.innerHeight - rect.bottom - pad;
    const spaceAbove = rect.top - pad;
    const preferUp = spaceBelow < Math.min(maxMenuHeight, 160) && spaceAbove > spaceBelow;
    setPlacement(preferUp ? "up" : "down");
    setMenuMax(Math.max(120, Math.min(maxMenuHeight, preferUp ? spaceAbove : spaceBelow)));
  }, [open, maxMenuHeight, options.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  function onTriggerKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  }

  const menuStyle = {
    "--smooth-menu-max": `${menuMax}px`,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={cn(
        "smooth-select",
        open && "is-open",
        error && "is-error",
        placement === "up" && "is-drop-up",
        className
      )}
      style={menuStyle}
    >
      <button
        type="button"
        className="smooth-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKey}
      >
        <span className={cn("smooth-select-value", !selected && "is-placeholder")}>
          {selected?.prefix ? (
            <span className="smooth-select-prefix" aria-hidden>
              {selected.prefix}
            </span>
          ) : null}
          {selected?.label || placeholder}
        </span>
        <ChevronDown className="smooth-select-chevron" aria-hidden />
      </button>
      {open ? (
        <ul
          id={listId}
          className={cn("smooth-select-menu", menuClassName)}
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((opt) => (
            <li key={opt.value || "empty"}>
              <button
                type="button"
                role="option"
                aria-selected={opt.value === value}
                className={cn(
                  "smooth-select-option",
                  opt.value === value && "is-selected"
                )}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.prefix ? (
                  <span className="smooth-select-prefix" aria-hidden>
                    {opt.prefix}
                  </span>
                ) : null}
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

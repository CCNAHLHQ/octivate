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
import { cn } from "@/lib/utils";

type Side = "top" | "bottom" | "right";

/**
 * Portal + fixed positioning so tooltips are never clipped by overflow:hidden ancestors
 * (sidebar, cards, operator panels).
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className,
  wrap = true,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: Side;
  className?: string;
  /** Set false when wrapping a button (avoids invalid nesting). */
  wrap?: boolean;
}) {
  const tipId = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const el = anchorRef.current;
    const tip = tipRef.current;
    if (!el || !tip) return;
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const gap = 8;
    let top = 0;
    let left = 0;
    if (side === "right") {
      top = r.top + r.height / 2 - t.height / 2;
      left = r.right + gap;
    } else if (side === "bottom") {
      top = r.bottom + gap;
      left = r.left + r.width / 2 - t.width / 2;
    } else {
      top = r.top - t.height - gap;
      left = r.left + r.width / 2 - t.width / 2;
    }
    const pad = 8;
    left = Math.min(Math.max(pad, left), window.innerWidth - t.width - pad);
    top = Math.min(Math.max(pad, top), window.innerHeight - t.height - pad);
    setCoords({ top, left });
  }, [side]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onReposition = () => place();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, place, content]);

  const tip =
    mounted && open && content ? (
      createPortal(
        <span
          ref={tipRef}
          id={tipId}
          role="tooltip"
          className={cn("ui-tooltip is-portal", `is-${side}`, open && "is-visible")}
          style={
            coords
              ? { top: coords.top, left: coords.left }
              : { top: -9999, left: -9999, visibility: "hidden" }
          }
        >
          {content}
        </span>,
        document.body
      )
    ) : null;

  const shellProps = {
    ref: anchorRef,
    className: cn("ui-tooltip-wrap", className),
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
    "aria-describedby": open ? tipId : undefined,
  } as const;

  if (!wrap) {
    return (
      <span {...shellProps}>
        {children}
        {tip}
      </span>
    );
  }

  return (
    <span {...shellProps} tabIndex={0}>
      {children}
      {tip}
    </span>
  );
}

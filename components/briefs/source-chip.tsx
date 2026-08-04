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
import { ExternalLink, FileText } from "lucide-react";
import type { BriefCitedSource } from "@/lib/types";
import {
  claimSourcePopover,
  nearbySourceChipRects,
  placeSourcePopover,
  releaseSourcePopover,
  subscribeSourcePopover,
  type SourcePopoverCoords,
} from "@/lib/briefs/source-popover";
import { cn } from "@/lib/utils";
import { useMounted } from "@/lib/use-mounted";

const CLOSE_DELAY_MS = 220;
const POPOVER_WIDTH = 300;

function hostLabel(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}

export function SourceChip({
  source,
  className,
}: {
  source: BriefCitedSource;
  className?: string;
}) {
  const uid = useId();
  const popoverId = `src-pop-${source.id}-${uid.replace(/:/g, "")}`;
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<SourcePopoverCoords | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);

  const host = hostLabel(source.url);
  const meta = [host, source.publishedAt ? `Published ${source.publishedAt}` : null]
    .filter(Boolean)
    .join(" · ");

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  const hideNow = useCallback(() => {
    clearCloseTimer();
    setOpen(false);
    releaseSourcePopover(popoverId);
  }, [popoverId]);

  const show = useCallback(() => {
    clearCloseTimer();
    claimSourcePopover(popoverId);
    setOpen(true);
  }, [popoverId]);

  function scheduleHide() {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      releaseSourcePopover(popoverId);
    }, CLOSE_DELAY_MS);
  }

  useEffect(() => () => {
    clearCloseTimer();
    releaseSourcePopover(popoverId);
  }, [popoverId]);

  // Only one source popover at a time — close if a neighbor claims focus.
  useEffect(() => {
    return subscribeSourcePopover((active) => {
      if (active && active !== popoverId) {
        clearCloseTimer();
        setOpen(false);
      }
    });
  }, [popoverId]);

  const place = useCallback(() => {
    const anchor = rootRef.current;
    const pop = popRef.current;
    if (!anchor || !pop) return;
    const ar = anchor.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    const width = pr.width || Math.min(POPOVER_WIDTH, window.innerWidth * 0.78);
    const height = pr.height || 120;
    const siblings = nearbySourceChipRects(anchor);
    setCoords(placeSourcePopover(ar, width, height, siblings));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    const ro =
      typeof ResizeObserver !== "undefined" && popRef.current
        ? new ResizeObserver(onMove)
        : null;
    if (popRef.current && ro) ro.observe(popRef.current);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      ro?.disconnect();
    };
  }, [open, place, source.title, source.snippet]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return;
      hideNow();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") hideNow();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, hideNow]);

  const popover =
    mounted && open ? (
      createPortal(
        <span
          ref={popRef}
          className={cn(
            "brief-source-popover is-portal",
            coords?.side === "top" && "is-above",
            coords && "is-placed"
          )}
          id={popoverId}
          role="dialog"
          aria-label={source.title}
          style={
            coords
              ? { top: coords.top, left: coords.left }
              : { top: -9999, left: -9999, visibility: "hidden" }
          }
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
        >
          <span className="brief-source-popover-title">{source.title}</span>
          {meta ? <span className="brief-source-popover-meta">{meta}</span> : null}
          {source.snippet ? (
            <span className="brief-source-popover-snippet">{source.snippet}</span>
          ) : null}
          <span className="brief-source-popover-metrics">
            {source.passageCount != null ? (
              <span>
                {source.passageCount} passage
                {source.passageCount === 1 ? "" : "s"} referenced
              </span>
            ) : null}
            {source.pageCoveragePct != null ? (
              <span>~{source.pageCoveragePct}% of page</span>
            ) : null}
          </span>
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="brief-source-popover-link"
              onMouseDown={(e) => e.stopPropagation()}
            >
              View source
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
        </span>,
        document.body
      )
    ) : null;

  return (
    <span
      ref={rootRef}
      data-source-chip
      className={cn("brief-source-chip", open && "is-open", className)}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
    >
      <button
        type="button"
        className="brief-source-chip-btn"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => {
          if (open) hideNow();
          else show();
        }}
        onFocus={show}
        onBlur={(e) => {
          if (
            !rootRef.current?.contains(e.relatedTarget as Node) &&
            !popRef.current?.contains(e.relatedTarget as Node)
          ) {
            scheduleHide();
          }
        }}
      >
        <FileText className="h-3 w-3" aria-hidden />
        {source.label}
      </button>
      {popover}
    </span>
  );
}

/** Attach chips after list items that mention Source N or evidence IDs. */
export function withInlineSourceChips(
  text: string,
  sources: BriefCitedSource[] | undefined
): ReactNode {
  if (!sources?.length) return text;
  const byLabel = new Map(sources.map((s) => [s.label.toLowerCase(), s]));
  const parts = text.split(/(\bSource\s+\d+\b)/gi);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    const hit = byLabel.get(part.toLowerCase());
    if (hit) {
      return (
        <span key={`${hit.id}-${i}`} className="inline-flex items-center gap-1">
          {" "}
          <SourceChip source={hit} />
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

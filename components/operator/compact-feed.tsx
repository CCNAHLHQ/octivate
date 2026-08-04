"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_INITIAL = 6;
const DEFAULT_STEP = 6;

export function CompactFeed<T>({
  items,
  getKey,
  getTime,
  renderItem,
  empty,
  initial = DEFAULT_INITIAL,
  step = DEFAULT_STEP,
  label = "entries",
  className,
}: {
  items: T[];
  getKey: (item: T) => string;
  getTime: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  empty: ReactNode;
  initial?: number;
  step?: number;
  label?: string;
  className?: string;
}) {
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        const tb = Date.parse(getTime(b)) || 0;
        const ta = Date.parse(getTime(a)) || 0;
        return tb - ta;
      }),
    [items, getTime]
  );

  const [visible, setVisible] = useState(initial);

  useEffect(() => {
    setVisible((v) => Math.min(Math.max(v, initial), Math.max(initial, sorted.length)));
  }, [sorted.length, initial]);

  if (sorted.length === 0) return <>{empty}</>;

  const shown = sorted.slice(0, visible);
  const remaining = Math.max(0, sorted.length - visible);
  const expanded = visible > initial;
  const canExpand = remaining > 0;

  return (
    <div className={cn("op-compact-feed", className)}>
      <div className="op-compact-scroll" role="region" aria-label={`Recent ${label}`}>
        <ul className="op-ledger-list" role="list">
          {shown.map((item) => renderItem(item))}
        </ul>
      </div>

      {(canExpand || expanded) && (
        <div className="op-compact-foot">
          {canExpand ? (
            <button
              type="button"
              className="op-compact-more"
              onClick={() => setVisible((v) => Math.min(sorted.length, v + step))}
            >
              <span>Show more</span>
              <span className="op-compact-more-count">
                {remaining} older {label}
              </span>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              className="op-compact-more is-collapse"
              onClick={() => setVisible(initial)}
            >
              <span>Show less</span>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          {canExpand && expanded ? (
            <button
              type="button"
              className="op-compact-less"
              onClick={() => setVisible(initial)}
              aria-label="Collapse to recent entries"
            >
              Collapse
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

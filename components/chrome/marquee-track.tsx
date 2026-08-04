"use client";

import { useMemo } from "react";
import type { MarqueeItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export type MarqueeDraft = {
  badge: string;
  kind: MarqueeItem["kind"];
  text: string;
};

function MarqueeChip({
  badge,
  kind,
  text,
  ghost = false,
}: {
  badge: string;
  kind: MarqueeItem["kind"];
  text: string;
  ghost?: boolean;
}) {
  return (
    <span className={cn("tick-item", ghost && "is-draft")}>
      <span className={cn("tick-tag", kind)}>{badge}</span>
      {text}
    </span>
  );
}

export function MarqueeTrack({
  items,
  draft,
  variant = "site",
  className,
  emptyLabel = "No live signals",
}: {
  items: MarqueeItem[];
  draft?: MarqueeDraft | null;
  variant?: "site" | "preview";
  className?: string;
  emptyLabel?: string;
}) {
  const active = useMemo(
    () => [...items].filter((item) => item.enabled).sort((a, b) => a.sortOrder - b.sortOrder),
    [items]
  );

  const showDraft = Boolean(draft && draft.text.trim().length >= 4);

  const sequence = useMemo(() => {
    const base = active.map((item) => ({
      key: item.id,
      badge: item.badge,
      kind: item.kind,
      text: item.text,
      ghost: false as boolean,
    }));
    if (showDraft && draft) {
      base.push({
        key: "draft",
        badge: draft.badge || "DRAFT",
        kind: draft.kind,
        text: draft.text.trim(),
        ghost: true,
      });
    }
    return base;
  }, [active, draft, showDraft]);

  if (!sequence.length) {
    return (
      <div
        className={cn(
          "marquee-track-shell",
          variant === "site" ? "site-marquee ticker" : "op-ticker-rail",
          "is-empty",
          className
        )}
        role={variant === "site" ? "marquee" : "status"}
        aria-live="polite"
      >
        <div className="marquee-track-empty">{emptyLabel}</div>
      </div>
    );
  }

  // Build a dense unit for short feeds, then duplicate once for a -50% seamless loop.
  const unit = sequence.length < 3 ? [...sequence, ...sequence, ...sequence] : sequence;
  const loop = [...unit, ...unit].map((item, i) => ({ ...item, copy: i }));

  const durationSec = Math.min(72, Math.max(18, sequence.length * 9 + (showDraft ? 6 : 0)));
  const fingerprint = sequence.map((s) => `${s.key}:${s.text}`).join("|");

  return (
    <div
      className={cn(
        "marquee-track-shell ticker",
        variant === "site" ? "site-marquee" : "op-ticker-rail",
        className
      )}
      aria-live="polite"
      role={variant === "site" ? "marquee" : "presentation"}
      aria-hidden={variant === "preview" ? true : undefined}
    >
      <div
        key={fingerprint}
        className={cn(
          "ticker-track marquee-track-run",
          variant === "site" && "site-marquee-track"
        )}
        style={{ animationDuration: `${durationSec}s` }}
      >
        {loop.map((item) => (
          <MarqueeChip
            key={`${item.key}-${item.copy}`}
            badge={item.badge}
            kind={item.kind}
            text={item.text}
            ghost={item.ghost}
          />
        ))}
      </div>
    </div>
  );
}

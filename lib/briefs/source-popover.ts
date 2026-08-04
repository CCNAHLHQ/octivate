/** Exclusive open + collision-aware placement for brief source chip popovers. */

type Listener = (activeId: string | null) => void;

let activeId: string | null = null;
const listeners = new Set<Listener>();

export function claimSourcePopover(id: string) {
  if (activeId === id) return;
  activeId = id;
  listeners.forEach((fn) => fn(activeId));
}

export function releaseSourcePopover(id: string) {
  if (activeId !== id) return;
  activeId = null;
  listeners.forEach((fn) => fn(null));
}

export function subscribeSourcePopover(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export type SourcePopoverCoords = {
  top: number;
  left: number;
  side: "top" | "bottom";
};

type RectLike = Pick<DOMRect, "top" | "right" | "bottom" | "left" | "width" | "height">;

function overlapArea(a: RectLike, b: RectLike, pad = 0): number {
  const left = Math.max(a.left - pad, b.left - pad);
  const right = Math.min(a.right + pad, b.right + pad);
  const top = Math.max(a.top - pad, b.top - pad);
  const bottom = Math.min(a.bottom + pad, b.bottom + pad);
  const w = right - left;
  const h = bottom - top;
  if (w <= 0 || h <= 0) return 0;
  return w * h;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

/**
 * Pick a popover position that stays in-viewport and avoids covering nearby source chips.
 */
export function placeSourcePopover(
  anchor: RectLike,
  popW: number,
  popH: number,
  siblings: RectLike[] = []
): SourcePopoverCoords {
  const gap = 8;
  const pad = 10;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  const candidates: SourcePopoverCoords[] = [
    { side: "bottom", top: anchor.bottom + gap, left: anchor.left },
    {
      side: "bottom",
      top: anchor.bottom + gap,
      left: anchor.left + anchor.width / 2 - popW / 2,
    },
    { side: "bottom", top: anchor.bottom + gap, left: anchor.right - popW },
    { side: "top", top: anchor.top - gap - popH, left: anchor.left },
    {
      side: "top",
      top: anchor.top - gap - popH,
      left: anchor.left + anchor.width / 2 - popW / 2,
    },
    { side: "top", top: anchor.top - gap - popH, left: anchor.right - popW },
  ];

  // If siblings sit mostly to the right of the anchor, prefer left-aligned / top so we
  // don't blanket the neighboring chips in a dense row.
  const rightCluster = siblings.filter(
    (s) => s.left >= anchor.left - 4 && Math.abs(s.top - anchor.top) < 28
  ).length;
  const leftCluster = siblings.filter(
    (s) => s.right <= anchor.right + 4 && Math.abs(s.top - anchor.top) < 28
  ).length;

  let best = candidates[0];
  let bestScore = -Infinity;

  for (const raw of candidates) {
    const left = clamp(raw.left, pad, Math.max(pad, vw - popW - pad));
    const top = clamp(raw.top, pad, Math.max(pad, vh - popH - pad));
    const placed: RectLike = {
      left,
      top,
      right: left + popW,
      bottom: top + popH,
      width: popW,
      height: popH,
    };

    let score = 0;
    // Prefer requested side (before clamp flipped it into view awkwardly).
    if (raw.side === "bottom") score += 40;
    else score += 28;

    // Alignment preference based on nearby chip density.
    const startBias = Math.abs(raw.left - anchor.left);
    const endBias = Math.abs(raw.left - (anchor.right - popW));
    if (rightCluster >= leftCluster && startBias < endBias) score += 18;
    if (leftCluster > rightCluster && endBias < startBias) score += 18;

    // Penalize viewport overflow before clamp (how far we had to shove it).
    score -= Math.abs(left - raw.left) * 0.35;
    score -= Math.abs(top - raw.top) * 0.45;

    // Heavily penalize covering other source chips.
    for (const sib of siblings) {
      const area = overlapArea(placed, sib, 2);
      if (area > 0) score -= 80 + area * 0.08;
    }

    // Slight preference to stay near the chip horizontally.
    const chipCx = anchor.left + anchor.width / 2;
    const popCx = left + popW / 2;
    score -= Math.abs(chipCx - popCx) * 0.05;

    if (score > bestScore) {
      bestScore = score;
      best = { side: raw.side, top, left };
    }
  }

  return best;
}

/** Collect sibling chip rects near an anchor (same brief row / cluster). */
export function nearbySourceChipRects(
  anchorEl: HTMLElement,
  maxDistance = 220
): DOMRect[] {
  const self = anchorEl.getBoundingClientRect();
  const nodes = document.querySelectorAll<HTMLElement>("[data-source-chip]");
  const out: DOMRect[] = [];
  nodes.forEach((node) => {
    if (node === anchorEl) return;
    const r = node.getBoundingClientRect();
    const dx = Math.max(self.left - r.right, r.left - self.right, 0);
    const dy = Math.max(self.top - r.bottom, r.top - self.bottom, 0);
    if (dx * dx + dy * dy <= maxDistance * maxDistance) out.push(r);
  });
  return out;
}

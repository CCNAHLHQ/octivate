"use client";

import type { ReactNode, DragEvent } from "react";
import { GripVertical, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import type {
  OperatorLayoutModule,
  OperatorLayoutSlot,
} from "@/lib/hooks/use-operator-layout";
import { cn } from "@/lib/utils";

export type OperatorModuleDef = {
  title: string;
  hint?: string;
  node: ReactNode;
  bodyClassName?: string;
  /** Keep intrinsic height (e.g. moderation 5-row frame); never flex-fill. */
  fixedFrame?: boolean;
};

export type OperatorModuleContext = {
  slot: OperatorLayoutSlot;
  slotCount: number;
  slotIndex: number;
  isSole: boolean;
  isFirst: boolean;
  isLast: boolean;
  /** Absorb leftover column height when stacked beside taller siblings. */
  fill: boolean;
};

export function OperatorModule({
  title,
  hint,
  actions,
  children,
  className,
  bodyClassName,
  draggable,
  dragId,
  overId,
  moduleId,
  slot,
  density,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  draggable?: boolean;
  dragId?: string | null;
  overId?: string | null;
  moduleId?: string;
  slot?: OperatorLayoutSlot;
  density?: OperatorModuleContext & { fixedFrame?: boolean };
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  onDragOver?: (id: string) => void;
  onDrop?: (id: string, slot: OperatorLayoutSlot) => void;
}) {
  const id = moduleId || title;
  const isDrop = Boolean(draggable && overId === id && dragId && dragId !== id);
  const isDragging = Boolean(draggable && dragId === id);

  function handleDragStart(e: DragEvent<HTMLElement>) {
    if (!draggable || !onDragStart) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    onDragStart(id);
  }

  return (
    <div
      className={cn(
        "ws-module op-module",
        isDrop && "is-drop-target",
        isDragging && "is-dragging",
        density?.fill && "is-fill",
        density?.fixedFrame && "is-fixed-frame",
        density && density.slotCount > 1 && "is-stacked",
        density?.isSole && "is-sole",
        density?.isFirst && "is-first",
        density?.isLast && "is-last",
        className
      )}
      data-slot={density?.slot || slot}
      data-slot-count={density?.slotCount}
      data-slot-index={density?.slotIndex}
      data-density={
        density?.fixedFrame
          ? "fixed"
          : density?.fill
            ? "fill"
            : density && density.slotCount > 1
              ? "stacked"
              : "default"
      }
      onDragOver={
        draggable && onDragOver
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              onDragOver(id);
            }
          : undefined
      }
      onDrop={
        draggable && onDrop && slot
          ? (e) => {
              e.preventDefault();
              onDrop(id, slot);
            }
          : undefined
      }
    >
      <div className="ws-module-chrome op-module-chrome">
        <span
          className={cn(
            "op-module-title-row",
            draggable && "op-module-drag-handle"
          )}
          draggable={draggable}
          onDragStart={draggable ? handleDragStart : undefined}
          onDragEnd={draggable ? onDragEnd : undefined}
        >
          <GripVertical className="h-3.5 w-3.5 text-faint" aria-hidden />
          <Tooltip
            content={hint || (draggable ? "Drag header to rearrange modules" : title)}
            side="top"
          >
            <span>{title}</span>
          </Tooltip>
        </span>
        {actions ? (
          <div
            className="op-module-actions"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        ) : null}
      </div>
      <Card className={cn("ws-module-body op-module-body p-4", bodyClassName)}>
        {children}
      </Card>
    </div>
  );
}

export function OperatorSplit({
  left,
  right,
  leftCount,
  rightCount,
  className,
}: {
  left: ReactNode;
  right: ReactNode;
  leftCount?: number;
  rightCount?: number;
  className?: string;
}) {
  return (
    <div className={cn("ws-split-grid op-split-grid relative z-[1]", className)}>
      <div
        className="ws-split-col op-split-col"
        data-slot="left"
        data-slot-count={leftCount ?? undefined}
      >
        {left}
      </div>
      <div
        className="ws-split-col op-split-col"
        data-slot="right"
        data-slot-count={rightCount ?? undefined}
      >
        {right}
      </div>
    </div>
  );
}

function buildDensity(
  mods: OperatorLayoutModule[],
  index: number,
  slot: OperatorLayoutSlot,
  fixedFrame: boolean
): OperatorModuleContext & { fixedFrame?: boolean } {
  const slotCount = mods.length;
  const isSole = slotCount === 1;
  const isFirst = index === 0;
  const isLast = index === slotCount - 1;
  // Fill leftover column height: sole content module, or last in a stack
  // (never fixed-frame modules like moderation).
  const fill = !fixedFrame && (isSole || isLast);
  return {
    slot,
    slotCount,
    slotIndex: index,
    isSole,
    isFirst,
    isLast,
    fill,
    fixedFrame,
  };
}

export function OperatorModularBoard({
  modulesFor,
  dragId,
  overId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  resetLayout,
  renderModule,
  className,
}: {
  modulesFor: (slot: OperatorLayoutSlot) => OperatorLayoutModule[];
  dragId: string | null;
  overId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (id: string) => void;
  onDrop: (id: string, slot: OperatorLayoutSlot) => void;
  resetLayout?: () => void;
  renderModule: (id: string) => OperatorModuleDef | null;
  className?: string;
}) {
  function renderSlot(slot: OperatorLayoutSlot) {
    const mods = modulesFor(slot);
    return mods.map((mod, index) => {
      const def = renderModule(mod.id);
      if (!def) return null;
      const density = buildDensity(mods, index, slot, Boolean(def.fixedFrame));
      return (
        <OperatorModule
          key={mod.id}
          moduleId={mod.id}
          title={def.title}
          hint={def.hint}
          bodyClassName={def.bodyClassName}
          density={density}
          draggable
          dragId={dragId}
          overId={overId}
          slot={slot}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {def.node}
        </OperatorModule>
      );
    });
  }

  const leftMods = modulesFor("left");
  const rightMods = modulesFor("right");

  return (
    <div className={cn("op-modular-board space-y-3", className)}>
      {resetLayout ? (
        <div className="op-modular-toolbar">
          <Tooltip content="Restore default module placement">
            <button type="button" className="op-strip-chip" onClick={resetLayout}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reset layout
            </button>
          </Tooltip>
          <span className="op-modular-hint">Drag module headers to rearrange</span>
        </div>
      ) : null}
      <OperatorSplit
        left={renderSlot("left")}
        right={renderSlot("right")}
        leftCount={leftMods.length}
        rightCount={rightMods.length}
      />
    </div>
  );
}

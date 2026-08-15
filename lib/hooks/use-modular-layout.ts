"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** 2-column modular board. Cells are addressed by col/row (not packed stacks). */
export type LayoutCol = 0 | 1;

export type LayoutModule = {
  id: string;
  col: LayoutCol;
  row: number;
};

/** @deprecated kept for migration typing */
export type LayoutSlot = "left" | "right";

type LegacyModule = {
  id: string;
  slot?: LayoutSlot;
  order?: number;
  col?: number;
  row?: number;
};

/** Topics + Actions + Monitors + Pulse (pulse folded into Agent card). */
const REMOVED_MODULE_IDS = new Set(["topics", "actions", "monitors", "insights"]);

const DEFAULT_MODULES: LayoutModule[] = [
  { id: "question", col: 0, row: 0 },
  { id: "pipeline", col: 1, row: 0 },
  { id: "documents", col: 0, row: 1 },
];

const EXTRA_EMPTY_ROWS = 2;

function storageKey(projectId: string) {
  return `octivate-project-layout-v2:${projectId}`;
}

function cellKey(col: number, row: number) {
  return `${col}:${row}`;
}

function migrate(raw: LegacyModule[]): LayoutModule[] {
  return raw
    .filter((m) => m?.id && !REMOVED_MODULE_IDS.has(m.id))
    .map((m) => {
      if (typeof m.col === "number" && typeof m.row === "number") {
        return {
          id: m.id,
          col: (m.col === 1 ? 1 : 0) as LayoutCol,
          row: Math.max(0, Math.floor(m.row)),
        };
      }
      // v1: slot + order → col + row
      const col: LayoutCol = m.slot === "right" ? 1 : 0;
      const row = typeof m.order === "number" ? Math.max(0, m.order) : 0;
      return { id: m.id, col, row };
    });
}

/** Ensure every default module exists and (col,row) pairs are unique. */
function normalize(items: LayoutModule[]): LayoutModule[] {
  const byId = new Map<string, LayoutModule>();
  for (const m of items) {
    if (REMOVED_MODULE_IDS.has(m.id)) continue;
    byId.set(m.id, {
      id: m.id,
      col: m.col === 1 ? 1 : 0,
      row: Math.max(0, Math.floor(m.row)),
    });
  }
  for (const d of DEFAULT_MODULES) {
    if (!byId.has(d.id)) byId.set(d.id, { ...d });
  }

  const occupied = new Set<string>();
  const next: LayoutModule[] = [];
  for (const m of byId.values()) {
    let { col, row } = m;
    let key = cellKey(col, row);
    while (occupied.has(key)) {
      row += 1;
      key = cellKey(col, row);
    }
    occupied.add(key);
    next.push({ id: m.id, col, row });
  }
  return next;
}

export type GridCell =
  | { kind: "module"; module: LayoutModule }
  | { kind: "empty"; col: LayoutCol; row: number };

export function useModularLayout(projectId: string) {
  const [modules, setModules] = useState<LayoutModule[]>(DEFAULT_MODULES);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCell, setOverCell] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const dragIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const v2 = localStorage.getItem(storageKey(projectId));
      const v1 = localStorage.getItem(`octivate-project-layout:${projectId}`);
      const raw = v2 || v1;
      if (raw) {
        const parsed = JSON.parse(raw) as LegacyModule[];
        if (Array.isArray(parsed) && parsed.length) {
          setModules(normalize(migrate(parsed)));
        } else {
          setModules(DEFAULT_MODULES.map((m) => ({ ...m })));
        }
      } else {
        setModules(DEFAULT_MODULES.map((m) => ({ ...m })));
      }
    } catch {
      setModules(DEFAULT_MODULES.map((m) => ({ ...m })));
    }
    setHydrated(true);
  }, [projectId]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey(projectId), JSON.stringify(modules));
    } catch {
      /* ignore quota */
    }
  }, [modules, projectId, hydrated]);

  const rowCount = useMemo(() => {
    const maxRow = modules.reduce((n, m) => Math.max(n, m.row), 0);
    return Math.max(3, maxRow + 1 + EXTRA_EMPTY_ROWS);
  }, [modules]);

  const cells = useMemo(() => {
    const map = new Map(modules.map((m) => [cellKey(m.col, m.row), m]));
    const list: GridCell[] = [];
    for (let row = 0; row < rowCount; row++) {
      for (const col of [0, 1] as LayoutCol[]) {
        const mod = map.get(cellKey(col, row));
        if (mod) list.push({ kind: "module", module: mod });
        else list.push({ kind: "empty", col, row });
      }
    }
    return list;
  }, [modules, rowCount]);

  const onDragStart = useCallback((id: string) => {
    dragIdRef.current = id;
    setDragId(id);
  }, []);

  const onDragEnd = useCallback(() => {
    dragIdRef.current = null;
    setDragId(null);
    setOverCell(null);
  }, []);

  const onDragOverCell = useCallback((col: LayoutCol, row: number) => {
    setOverCell(cellKey(col, row));
  }, []);

  /** Place dragged module onto a cell. Occupied cells swap; empty cells move in place. */
  const onDropCell = useCallback((col: LayoutCol, row: number) => {
    const movingId = dragIdRef.current;
    setModules((prev) => {
      if (!movingId) return prev;
      const next = prev.map((m) => ({ ...m }));
      const from = next.find((m) => m.id === movingId);
      if (!from) return prev;
      if (from.col === col && from.row === row) return prev;

      const occupant = next.find((m) => m.id !== movingId && m.col === col && m.row === row);
      if (occupant) {
        const prevCol = from.col;
        const prevRow = from.row;
        from.col = col;
        from.row = row;
        occupant.col = prevCol;
        occupant.row = prevRow;
      } else {
        from.col = col;
        from.row = row;
      }
      return normalize(next);
    });
    dragIdRef.current = null;
    setDragId(null);
    setOverCell(null);
  }, []);

  const resetLayout = useCallback(() => {
    setModules(DEFAULT_MODULES.map((m) => ({ ...m })));
  }, []);

  /** Legacy helpers so older call sites compile during transition. */
  const modulesFor = useCallback(
    (slot: LayoutSlot) =>
      modules
        .filter((m) => (slot === "right" ? m.col === 1 : m.col === 0))
        .sort((a, b) => a.row - b.row)
        .map((m) => ({ id: m.id, slot, order: m.row })),
    [modules]
  );

  return {
    modules,
    cells,
    rowCount,
    dragId,
    overCell,
    onDragStart,
    onDragEnd,
    onDragOverCell,
    onDropCell,
    resetLayout,
    modulesFor,
  };
}

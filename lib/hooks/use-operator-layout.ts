"use client";

import { useCallback, useEffect, useState } from "react";

export type OperatorLayoutSlot = "left" | "right";

export type OperatorLayoutModule = {
  id: string;
  slot: OperatorLayoutSlot;
  order: number;
};

function normalize(
  items: OperatorLayoutModule[],
  defaults: OperatorLayoutModule[]
): OperatorLayoutModule[] {
  const allowed = new Set(defaults.map((d) => d.id));
  const filtered = items.filter((m) => allowed.has(m.id));
  const byId = new Map(filtered.map((m) => [m.id, { ...m }]));
  for (const d of defaults) {
    if (!byId.has(d.id)) byId.set(d.id, { ...d });
  }
  const next = Array.from(byId.values());
  for (const slot of ["left", "right"] as OperatorLayoutSlot[]) {
    next
      .filter((m) => m.slot === slot)
      .sort((a, b) => a.order - b.order)
      .forEach((m, i) => {
        m.order = i;
      });
  }
  return next;
}

export function useOperatorLayout(
  boardId: string,
  defaults: OperatorLayoutModule[]
) {
  const storageKey = `octivate-operator-layout:${boardId}`;
  const [modules, setModules] = useState<OperatorLayoutModule[]>(() =>
    defaults.map((m) => ({ ...m }))
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as OperatorLayoutModule[];
        if (Array.isArray(parsed) && parsed.length) {
          setModules(normalize(parsed, defaults));
        } else {
          setModules(defaults.map((m) => ({ ...m })));
        }
      } else {
        setModules(defaults.map((m) => ({ ...m })));
      }
    } catch {
      setModules(defaults.map((m) => ({ ...m })));
    }
    setHydrated(true);
    // defaults are stable per boardId call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(modules));
    } catch {
      /* ignore quota */
    }
  }, [modules, storageKey, hydrated]);

  const modulesFor = useCallback(
    (slot: OperatorLayoutSlot) =>
      modules.filter((m) => m.slot === slot).sort((a, b) => a.order - b.order),
    [modules]
  );

  function onDragStart(id: string) {
    setDragId(id);
  }

  function onDragEnd() {
    setDragId(null);
    setOverId(null);
  }

  function onDragOver(id: string) {
    setOverId(id);
  }

  function onDrop(targetId: string, targetSlot: OperatorLayoutSlot) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }
    setModules((prev) => {
      const next = prev.map((m) => ({ ...m }));
      const from = next.find((m) => m.id === dragId);
      const to = next.find((m) => m.id === targetId);
      if (!from || !to) return prev;

      const fromSlot = from.slot;
      from.slot = targetSlot;

      const slotItems = next
        .filter((m) => m.slot === targetSlot && m.id !== dragId)
        .sort((a, b) => a.order - b.order);
      const insertAt = slotItems.findIndex((m) => m.id === targetId);
      const ordered = [...slotItems];
      ordered.splice(insertAt < 0 ? ordered.length : insertAt, 0, from);
      ordered.forEach((m, i) => {
        m.order = i;
      });

      if (fromSlot !== targetSlot) {
        next
          .filter((m) => m.slot === fromSlot)
          .sort((a, b) => a.order - b.order)
          .forEach((m, i) => {
            m.order = i;
          });
      }
      return next;
    });
    setDragId(null);
    setOverId(null);
  }

  function resetLayout() {
    setModules(defaults.map((m) => ({ ...m })));
  }

  return {
    modulesFor,
    dragId,
    overId,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
    resetLayout,
    hydrated,
  };
}

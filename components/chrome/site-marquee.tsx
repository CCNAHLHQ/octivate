"use client";

import { useCallback, useEffect, useState } from "react";
import { MarqueeTrack } from "@/components/chrome/marquee-track";
import { apiFetch } from "@/lib/api-client";
import { useWorkspaceRefresh } from "@/lib/hooks/use-workspace-refresh";
import type { MarqueeItem } from "@/lib/types";

const MARQUEE_POLL_MS = 30_000;

export function SiteMarquee() {
  const [items, setItems] = useState<MarqueeItem[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ items: MarqueeItem[] }>("/api/marquee", {
        skipCache: true,
      });
      setItems(data.items);
    } catch {
      /* keep last good ticker */
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), MARQUEE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  useWorkspaceRefresh(load, ["marquee"]);

  if (!items.length) return null;

  return <MarqueeTrack variant="site" items={items} />;
}

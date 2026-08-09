"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MarqueeTrack } from "@/components/chrome/marquee-track";
import { apiFetch } from "@/lib/api-client";
import { useWorkspaceRefresh } from "@/lib/hooks/use-workspace-refresh";
import { useLocale } from "@/components/i18n/locale-provider";
import type { MarqueeItem } from "@/lib/types";

const MARQUEE_POLL_MS = 30_000;

export function SiteMarquee() {
  const [items, setItems] = useState<MarqueeItem[]>([]);
  const { messages, locale } = useLocale();

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

  const localized = useMemo(() => {
    if (locale === "en") return items;
    return items.map((item) => ({
      ...item,
      text: messages[`dyn.marquee.${item.id}.text`] || item.text,
      badge: messages[`dyn.marquee.${item.id}.badge`] || item.badge,
    }));
  }, [items, messages, locale]);

  if (!localized.length) return null;

  return <MarqueeTrack variant="site" items={localized} />;
}

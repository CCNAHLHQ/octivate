"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { PublicUser } from "@/lib/auth/types";

type AuthSnapshot = {
  user: PublicUser | null;
  ready: boolean;
};

/** Module-level cache so sidebar/navbar paint the same session without a Sign-in flash. */
let cache: AuthSnapshot = { user: null, ready: false };
let inflight: Promise<PublicUser | null> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

async function fetchMe(): Promise<PublicUser | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Accept: "application/json" },
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as { user?: PublicUser | null };
      return data.user || null;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function invalidateOptionalAuth() {
  cache = { user: null, ready: false };
  notify();
}

export function setOptionalAuthUser(user: PublicUser | null) {
  cache = { user, ready: true };
  notify();
}

/**
 * Soft session probe for chrome + sidebar — never redirects.
 * Shares a process cache so Account never flashes “Sign in” after the first probe.
 */
export function useOptionalAuth() {
  const pathname = usePathname();
  const [, bump] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const onChange = () => {
      if (mounted.current) bump((n) => n + 1);
    };
    listeners.add(onChange);
    return () => {
      mounted.current = false;
      listeners.delete(onChange);
    };
  }, []);

  const refresh = useCallback(async () => {
    const user = await fetchMe();
    cache = { user, ready: true };
    notify();
    return user;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Paint cached session immediately when available.
      if (cache.ready) notify();
      const user = await fetchMe();
      if (cancelled) return;
      cache = { user, ready: true };
      notify();
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return {
    user: cache.user,
    ready: cache.ready,
    refresh,
  };
}

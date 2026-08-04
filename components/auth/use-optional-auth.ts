"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { PublicUser } from "@/lib/auth/types";

/**
 * Soft session probe for marketing chrome — never redirects.
 * `ready` stays false until the first /api/auth/me response settles.
 */
export function useOptionalAuth() {
  const pathname = usePathname();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Accept: "application/json" },
          credentials: "include",
          cache: "no-store",
        });
        const data = (await res.json()) as { user?: PublicUser | null };
        if (!cancelled) setUser(data.user || null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return { user, ready };
}

"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { invalidateApiCache } from "@/lib/api-client";

/**
 * Watches session validity on dashboard routes.
 * Expired / revoked sessions are cleared and redirected to sign-in.
 */
export function SessionGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const redirecting = useRef(false);

  useEffect(() => {
    if (!pathname.startsWith("/dashboard") && pathname !== "/operator") return;

    let cancelled = false;

    async function forceLogout(reason: string) {
      if (redirecting.current || cancelled) return;
      redirecting.current = true;
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
      } catch {
        /* ignore */
      }
      invalidateApiCache();
      const next = encodeURIComponent(pathname);
      router.replace(`/signin?next=${next}&reason=${encodeURIComponent(reason)}`);
    }

    async function check() {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const data = (await res.json()) as {
          user?: unknown;
          session?: { expiresAt?: string } | null;
        };
        if (!data.user) {
          await forceLogout("session_expired");
          return;
        }
        if (data.session?.expiresAt) {
          const exp = Date.parse(data.session.expiresAt);
          if (Number.isFinite(exp) && exp <= Date.now()) {
            await forceLogout("session_expired");
          }
        }
      } catch {
        /* network blip — retry next interval */
      }
    }

    void check();
    const interval = window.setInterval(() => void check(), 45_000);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [pathname, router]);

  return null;
}

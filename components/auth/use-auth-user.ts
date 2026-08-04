"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/auth/types";

export function useAuthUser(opts?: { requireOperator?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

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
        if (cancelled) return;
        const next = data.user || null;
        if (!next) {
          setLoading(false);
          router.replace(`/signin?next=${encodeURIComponent("/dashboard/operator")}`);
          return;
        }
        if (opts?.requireOperator && next.role !== "operator") {
          setLoading(false);
          router.replace("/dashboard");
          return;
        }
        setUser(next);
      } catch {
        if (!cancelled) {
          setLoading(false);
          router.replace("/signin");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, opts?.requireOperator]);

  return { user, loading };
}

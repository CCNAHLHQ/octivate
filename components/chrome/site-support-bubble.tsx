"use client";

import { usePathname } from "next/navigation";
import { SupportWidget } from "@/components/support/support-widget";
import { useOptionalAuth } from "@/components/auth/use-optional-auth";

/**
 * Customer support chat bubble for guests + members.
 * Hidden on operator routes (inbox owns support there).
 */
export function SiteSupportBubble() {
  const pathname = usePathname();
  const { user, ready } = useOptionalAuth();

  if (!ready) return null;
  if (
    pathname.startsWith("/operator") ||
    pathname.startsWith("/dashboard/operator")
  ) {
    return null;
  }
  if (user?.role === "operator") return null;
  return <SupportWidget user={user} />;
}

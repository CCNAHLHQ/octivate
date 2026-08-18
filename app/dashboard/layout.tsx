"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";

/**
 * Persist AppShell across dashboard routes so the workspace/operator tutorial
 * modal does not remount (and re-navigate) on every Next step.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const isOperator = pathname.startsWith("/dashboard/operator");
  return (
    <AppShell variant={isOperator ? "operator" : "user"}>{children}</AppShell>
  );
}

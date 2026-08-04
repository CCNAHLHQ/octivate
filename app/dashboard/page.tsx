"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/ui/route-loading";

const OverviewDashboard = dynamic(
  () =>
    import("@/components/dashboard/overview").then((m) => m.OverviewDashboard),
  {
    ssr: false,
    loading: () => <RouteLoading label="Preparing overview…" />,
  }
);

export default function DashboardPage() {
  return <OverviewDashboard />;
}

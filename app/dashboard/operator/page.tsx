"use client";

import dynamic from "next/dynamic";
import { RouteLoading } from "@/components/ui/route-loading";
import { OperatorGate } from "@/components/auth/operator-gate";
import "@/app/operator/operator.css";
import "@/app/operator/export.css";

const OperatorConsole = dynamic(
  () => import("@/components/dashboard/operator-console").then((m) => m.OperatorConsole),
  {
    ssr: false,
    loading: () => <RouteLoading label="Preparing operator console…" />,
  }
);

export default function DashboardOperatorPage() {
  return (
    <OperatorGate>
      <OperatorConsole />
    </OperatorGate>
  );
}

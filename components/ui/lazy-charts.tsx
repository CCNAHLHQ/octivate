"use client";

import dynamic from "next/dynamic";
import { useMounted } from "@/lib/use-mounted";
import { Skeleton } from "@/components/ui/progress";

const ConfidenceGauge = dynamic(
  () => import("@/components/ui/charts").then((m) => m.ConfidenceGauge),
  { ssr: false, loading: () => <Skeleton className="h-[13.5rem] w-full rounded-[var(--r-md)]" /> }
);
const DonutChart = dynamic(
  () => import("@/components/ui/charts").then((m) => m.DonutChart),
  { ssr: false, loading: () => <Skeleton className="min-h-[15.5rem] w-full rounded-[var(--r-md)]" /> }
);
const HorizontalRiskBars = dynamic(
  () => import("@/components/ui/charts").then((m) => m.HorizontalRiskBars),
  { ssr: false, loading: () => <Skeleton className="h-[15rem] w-full rounded-[var(--r-md)]" /> }
);
const DistBars = dynamic(
  () => import("@/components/ui/charts").then((m) => m.DistBars),
  { ssr: false, loading: () => <Skeleton className="h-[15rem] w-full rounded-[var(--r-md)]" /> }
);
const CapacityBars = dynamic(
  () => import("@/components/ui/charts").then((m) => m.CapacityBars),
  { ssr: false, loading: () => <Skeleton className="h-[15rem] w-full rounded-[var(--r-md)]" /> }
);

export function LazyConfidenceGauge(props: { value: number }) {
  const mounted = useMounted();
  if (!mounted) return <Skeleton className="h-[13.5rem] w-full rounded-[var(--r-md)]" />;
  return <ConfidenceGauge {...props} />;
}

export function LazyDonutChart(props: {
  segments: { name: string; value: number }[];
  centerLabel?: string;
}) {
  const mounted = useMounted();
  if (!mounted) return <Skeleton className="min-h-[15.5rem] w-full rounded-[var(--r-md)]" />;
  return <DonutChart {...props} />;
}

export function LazyHorizontalRiskBars(props: {
  items: { label: string; value: number; color?: string }[];
}) {
  const mounted = useMounted();
  if (!mounted) return <Skeleton className="h-[15rem] w-full rounded-[var(--r-md)]" />;
  return <HorizontalRiskBars {...props} />;
}

export function LazyDistBars(props: {
  items: { label: string; value: number; color?: string; detail?: string }[];
  heightClass?: string;
  valueLabel?: string;
}) {
  const mounted = useMounted();
  if (!mounted) return <Skeleton className="h-[15rem] w-full rounded-[var(--r-md)]" />;
  return <DistBars {...props} />;
}

export function LazyCapacityBars(props: {
  items: { label: string; used: number; limit: number; color?: string }[];
  heightClass?: string;
}) {
  const mounted = useMounted();
  if (!mounted) return <Skeleton className="h-[15rem] w-full rounded-[var(--r-md)]" />;
  return <CapacityBars {...props} />;
}

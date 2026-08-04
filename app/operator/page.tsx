"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RouteLoading } from "@/components/ui/route-loading";

/** Preserves hash when redirecting legacy /operator URLs. */
export default function OperatorLegacyRedirect() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash || "";
    router.replace(`/dashboard/operator${hash}`);
  }, [router]);

  return <RouteLoading label="Opening operator console…" />;
}

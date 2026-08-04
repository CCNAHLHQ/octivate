"use client";

import { useEffect, useState } from "react";

/** True only after client mount — use to gate SSR-unsafe UI (Recharts, etc.). */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

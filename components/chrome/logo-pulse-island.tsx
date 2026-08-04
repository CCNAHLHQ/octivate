"use client";

import Link from "next/link";
import { OctivateLogo } from "@/components/brand";

/**
 * CSS-only pulse — no Framer / dynamic(ssr:false), so SSR HTML matches client.
 * Pass `linked={false}` when nested inside another home link (e.g. brand).
 */
export function LogoPulseIsland({ linked = true }: { linked?: boolean }) {
  const mark = (
    <span className="logo-pulse-css" aria-hidden={!linked}>
      <OctivateLogo variant="mark" height={22} decorative />
    </span>
  );

  if (!linked) {
    return <span className="logo-pulse-link is-nested">{mark}</span>;
  }

  return (
    <Link href="/" className="logo-pulse-link" aria-label="Octivate home" title="Home">
      {mark}
    </Link>
  );
}

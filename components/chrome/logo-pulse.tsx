"use client";

import { motion, useReducedMotion } from "framer-motion";
import { OctivateLogo } from "@/components/brand";

/** Center logo with fade in → hold → fade out loop (respects reduced motion). */
export function LogoPulse({
  size = 36,
  variant = "mark",
}: {
  size?: number;
  variant?: "mark" | "stacked";
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <OctivateLogo
        variant={variant}
        height={size}
        decorative
      />
    );
  }

  return (
    <motion.span
      className="inline-flex items-center justify-center"
      animate={{ opacity: [0.35, 1, 1, 0.35], scale: [0.96, 1, 1, 0.96] }}
      transition={{
        duration: 3.2,
        ease: [0.22, 1, 0.36, 1],
        repeat: Infinity,
        times: [0, 0.25, 0.7, 1],
      }}
      aria-hidden="true"
    >
      <OctivateLogo variant={variant} height={size} decorative />
    </motion.span>
  );
}

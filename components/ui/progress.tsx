"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function ProgressBar({
  value,
  className,
  pulse,
}: {
  value: number;
  className?: string;
  pulse?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full rounded-full bg-white/8 overflow-hidden", className)}>
      <motion.div
        className={cn(
          "h-full rounded-full bg-gradient-to-r from-violet-deep to-violet",
          pulse && "animate-progress-pulse"
        )}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md bg-white/5 animate-pulse",
        className
      )}
    />
  );
}

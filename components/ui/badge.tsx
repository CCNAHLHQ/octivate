import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "high" | "moderate" | "low";
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "moderate", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "font-mono text-xs font-semibold tracking-wider px-2 py-1 rounded",
          {
            "text-[#7DEDE0] bg-[rgba(45,212,191,0.12)] border border-[rgba(45,212,191,0.35)]":
              variant === "high",
            "text-[#FFD98A] bg-[rgba(245,184,75,0.1)] border border-[rgba(245,184,75,0.35)]":
              variant === "moderate",
            "text-[#FFA79C] bg-[rgba(255,107,91,0.1)] border border-[rgba(255,107,91,0.35)]":
              variant === "low",
          },
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";

export { Badge };

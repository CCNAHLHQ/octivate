import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

interface PillProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "warn" | "info";
}

const Pill = forwardRef<HTMLDivElement, PillProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-2 font-mono text-xs tracking-wider px-3 py-1 rounded-full border border-line bg-white/2 text-mist",
          {
            "border-[rgba(245,184,75,0.35)] text-[#FFD98A] bg-[rgba(245,184,75,0.06)]":
              variant === "warn",
            "border-[rgba(120,150,255,0.3)] text-[#BBD0FF] bg-[rgba(120,150,255,0.06)]":
              variant === "info",
          },
          className
        )}
        {...props}
      >
        {variant === "default" && (
          <span className="w-1.5 h-1.5 rounded-full bg-tide shadow-[0_0_8px_rgba(45,212,191,0.25)]" />
        )}
        {variant === "warn" && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber shadow-[0_0_8px_rgba(245,184,75,0.5)]" />
        )}
        {variant === "info" && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#BBD0FF]" />
        )}
        {children}
      </div>
    );
  }
);

Pill.displayName = "Pill";

export { Pill };

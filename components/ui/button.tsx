import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "inert";
  size?: "default" | "sm";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-180",
          "active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed rounded-full",
          {
            "bg-gradient-to-br from-violet to-violet-deep text-white shadow-[0_10px_30px_-8px_rgba(168,85,247,0.35),0_0_0_1px_rgba(255,255,255,0.08)_inset] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-8px_rgba(168,85,247,0.35)]":
              variant === "primary",
            "border border-[rgba(154,171,255,0.26)] text-foam bg-white/[0.02] hover:border-violet hover:bg-violet/10":
              variant === "ghost",
            "border border-[rgba(255,107,91,0.4)] text-[#FFA79C] bg-[rgba(255,107,91,0.06)] hover:bg-[rgba(255,107,91,0.14)]":
              variant === "danger",
            "opacity-55 cursor-not-allowed": variant === "inert",
          },
          {
            "px-5 py-2.5 text-sm": size === "default",
            "px-3.5 py-1.5 text-xs": size === "sm",
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
export { Button };

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "w-full rounded-[10px] border border-[var(--line-strong)] bg-[var(--ink)] px-3 py-2 text-sm text-[var(--foam)] outline-none transition-colors duration-150 placeholder:text-[var(--faint)] focus:border-[var(--accent-soft-border)] focus:bg-[var(--abyss)] focus:shadow-[0_0_0_3px_var(--accent-soft-bg)]",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
export { Input };

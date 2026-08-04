import { cn } from "@/lib/utils";
import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  compact?: boolean;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, compact, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn("ui-select", compact && "is-compact", className)}
        {...props}
      />
    );
  }
);

Select.displayName = "Select";
export { Select };

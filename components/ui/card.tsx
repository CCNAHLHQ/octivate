import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "dash-card",
          hover && "transition-colors duration-200 hover:border-[rgba(168,85,247,0.35)]",
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = "Card";
export { Card };

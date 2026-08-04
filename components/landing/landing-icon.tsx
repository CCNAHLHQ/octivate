import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  violet: "land-icon-violet",
  tide: "land-icon-tide",
  coral: "land-icon-coral",
  amber: "land-icon-amber",
  mist: "land-icon-mist",
} as const;

export function LandingIcon({
  icon: Icon,
  tone = "violet",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span className={cn("land-icon", TONES[tone], `land-icon-${size}`, className)}>
      <Icon aria-hidden strokeWidth={1.75} />
    </span>
  );
}

import { cn } from "@/lib/utils";

const tones = {
  violet: "bg-violet/15 text-[#E5D0FF] border-violet/30",
  teal: "bg-tide/15 text-[#7DEDE0] border-tide/30",
  coral: "bg-coral/15 text-[#FFA79C] border-coral/30",
  amber: "bg-amber/15 text-amber border-amber/30",
  info: "bg-info/15 text-info border-info/30",
  mist: "bg-white/5 text-mist border-[rgba(154,171,255,0.14)]",
} as const;

export function StatusBadge({
  children,
  tone = "mist",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function severityTone(severity: string): keyof typeof tones {
  const s = severity.toLowerCase();
  if (s === "critical" || s === "fail" || s === "failed" || s === "high" || s === "opposed")
    return "coral";
  if (s === "medium" || s === "degraded" || s === "paused" || s === "draft") return "amber";
  if (s === "low" || s === "info" || s === "running" || s === "neutral") return "info";
  if (
    s === "completed" ||
    s === "active" ||
    s === "healthy" ||
    s === "final" ||
    s === "supportive" ||
    s === "ok"
  )
    return "teal";
  if (s === "pending") return "violet";
  return "mist";
}

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function OverviewStatCard({
  title,
  subtitle,
  children,
  className,
  bodyClassName,
  id,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <Card id={id} className={cn("overview-stat-card", className)}>
      <div className="overview-stat-card-head">
        <h2 className="overview-stat-card-title">{title}</h2>
        {subtitle ? <p className="overview-stat-card-sub">{subtitle}</p> : null}
      </div>
      <div className={cn("overview-stat-card-body", bodyClassName)}>{children}</div>
    </Card>
  );
}

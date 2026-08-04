import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function OperatorStatCard({
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
    <Card id={id} className={cn("op-stat-card", className)}>
      <div className="op-stat-card-head">
        <h3 className="op-stat-card-title">{title}</h3>
        {subtitle ? <p className="op-stat-card-sub">{subtitle}</p> : null}
      </div>
      <div className={cn("op-stat-card-body", bodyClassName)}>{children}</div>
    </Card>
  );
}

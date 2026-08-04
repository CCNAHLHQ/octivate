import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function OperatorEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="op-empty-state">
      <div className="op-empty-icon" aria-hidden>
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="op-empty-title">{title}</h3>
      {description && <p className="op-empty-desc">{description}</p>}
      {action && <div className="op-empty-action">{action}</div>}
    </div>
  );
}

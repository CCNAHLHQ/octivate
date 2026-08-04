import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function WorkspaceEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="ws-empty">
      <div className="ws-empty-icon" aria-hidden>
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="ws-empty-title">{title}</h2>
      <p className="ws-empty-desc">{description}</p>
      {action && <div className="ws-empty-action">{action}</div>}
    </div>
  );
}

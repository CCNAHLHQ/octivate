import type { ReactNode } from "react";

export function WorkspacePageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="ws-page-header">
      <div className="ws-page-header-copy">
        {eyebrow && <p className="ws-eyebrow">{eyebrow}</p>}
        <h1 className="ws-page-title">{title}</h1>
        {description && <p className="ws-page-desc">{description}</p>}
      </div>
      {actions && <div className="ws-page-actions">{actions}</div>}
    </header>
  );
}

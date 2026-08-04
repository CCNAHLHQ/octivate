import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function OperatorSection({
  id,
  icon: Icon,
  title,
  description,
  actions,
  children,
  embedded = false,
}: {
  id?: string;
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Hide section chrome when nested inside a modular board module. */
  embedded?: boolean;
}) {
  return (
    <section className={embedded ? "op-section is-embedded" : "op-section"} id={id}>
      {!embedded && (
        <div className="op-section-head">
          <div>
            <h2 className="op-section-title">
              {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
              {title}
            </h2>
            {description && <p className="op-section-desc">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {embedded && actions ? <div className="op-section-embedded-actions">{actions}</div> : null}
      {children}
    </section>
  );
}

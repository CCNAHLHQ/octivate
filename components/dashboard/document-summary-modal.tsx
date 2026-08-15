"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  BookOpen,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";

type Doc = Project["documents"][number];

type Mode = "compose" | "view";

export type DocsFeatureCapabilities = {
  enabled: boolean;
  model: string;
  allowFocus: boolean;
  allowRework: boolean;
};

export type SummaryModalProps = {
  open: boolean;
  mode: Mode;
  document: Doc | null;
  projectName?: string;
  country?: string;
  sector?: string;
  running?: boolean;
  capabilities?: DocsFeatureCapabilities;
  onClose: () => void;
  onSwitchMode?: (mode: Mode) => void;
  onGenerate: (focus: string) => void | Promise<void>;
};

function Section({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: ReactNode;
  tone?: "default" | "warn" | "accent";
}) {
  return (
    <section className={cn("ws-sum-section", tone !== "default" && `is-${tone}`)}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function DocumentSummaryModal({
  open,
  mode,
  document: doc,
  running = false,
  capabilities,
  onClose,
  onSwitchMode,
  onGenerate,
}: SummaryModalProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [focus, setFocus] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !doc) return;
    setFocus(doc.summaryFocus || "");
  }, [open, doc?.id, doc?.summaryFocus]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !running) onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, running, onClose]);

  const hasSummary = Boolean(doc?.summary?.trim());
  const payload = doc?.summaryPayload;
  const allowFocus = capabilities?.allowFocus !== false;
  const allowRework = capabilities?.allowRework !== false;
  const docsEnabled = capabilities?.enabled !== false;
  const paragraphs = useMemo(() => {
    const summary = doc?.summary?.trim() || "";
    return summary
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [doc?.summary]);

  if (!mounted || !open || !doc) return null;

  const isRework = hasSummary;
  const canView = hasSummary && !running;
  const canGenerate = docsEnabled && (!hasSummary || allowRework);

  const panel = (
    <div className="ws-doc-modal-root" role="presentation">
      <button
        type="button"
        className="ws-doc-modal-backdrop"
        aria-label="Close"
        disabled={running}
        onClick={() => {
          if (!running) onClose();
        }}
      />
      <div
        className={cn("ws-doc-modal-panel", "is-sum", mode === "compose" && "is-compose")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={running || undefined}
      >
        <header className="ws-doc-modal-head">
          <div className="min-w-0">
            <p className="ws-doc-modal-kicker">
              {mode === "view" ? "Summary" : isRework ? "Rework summary" : "Summarize"}
            </p>
            <h2 id={titleId} className="ws-doc-modal-title" title={doc.name}>
              {doc.name}
            </h2>
          </div>
          <div className="ws-sum-head-actions">
            {mode === "view" && canView && allowRework && docsEnabled ? (
              <button
                type="button"
                className="ws-sum-ghost-btn"
                onClick={() => onSwitchMode?.("compose")}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Rework
              </button>
            ) : null}
            {mode === "compose" && canView ? (
              <button
                type="button"
                className="ws-sum-ghost-btn"
                disabled={running}
                onClick={() => onSwitchMode?.("view")}
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden />
                View
              </button>
            ) : null}
            <button
              type="button"
              className="op-icon-btn"
              onClick={onClose}
              disabled={running}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {mode === "compose" ? (
          <div className="ws-doc-modal-body">
            <div className="ws-doc-modal-scroll">
              {allowFocus ? (
                <label className="ws-sum-focus">
                  <span className="ws-sum-focus-label">
                    Focus <em>(optional)</em>
                  </span>
                  <textarea
                    value={focus}
                    disabled={running || !canGenerate}
                    onChange={(e) => setFocus(e.target.value.slice(0, 1200))}
                    rows={3}
                    placeholder="What should the summary emphasize?"
                  />
                </label>
              ) : null}

              {!docsEnabled ? (
                <div className="ws-sum-failed" role="alert">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  <p>Summarization is disabled.</p>
                </div>
              ) : null}

              {docsEnabled && hasSummary && !allowRework ? (
                <div className="ws-sum-failed" role="alert">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  <p>Rework is disabled. Open the existing summary instead.</p>
                </div>
              ) : null}

              {running ? (
                <div className="ws-sum-running" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <p>Extracting and summarizing…</p>
                </div>
              ) : null}

              {doc.summaryStatus === "failed" && !running ? (
                <div className="ws-sum-failed" role="alert">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  <p>Last run failed. Try again.</p>
                </div>
              ) : null}
            </div>

            <footer className="ws-sum-foot">
              <button
                type="button"
                className="ws-sum-primary"
                disabled={running || !canGenerate}
                onClick={() => void onGenerate(allowFocus ? focus.trim() : "")}
              >
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Working…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" aria-hidden />
                    {isRework ? "Regenerate" : "Generate"}
                  </>
                )}
              </button>
            </footer>
          </div>
        ) : (
          <div className="ws-doc-modal-body">
            <div className="ws-doc-modal-scroll">
              {doc.summaryAt ? (
                <p className="ws-sum-meta">
                  {new Date(doc.summaryAt).toLocaleString()}
                  {payload?.status ? ` · ${payload.status.replace(/_/g, " ")}` : ""}
                </p>
              ) : null}

              {paragraphs.length ? (
                paragraphs.map((p, i) => (
                  <p key={i} className={cn("ws-doc-modal-p", i === 0 && "is-lead")}>
                    {p}
                  </p>
                ))
              ) : (
                <p className="ws-doc-modal-p is-lead">No summary text available.</p>
              )}

              {payload?.decision_relevance ? (
                <Section title="Decision relevance" tone="accent">
                  <p className="ws-doc-modal-p">{payload.decision_relevance}</p>
                </Section>
              ) : null}

              {payload?.key_points && payload.key_points.length > 0 ? (
                <Section title="Key points">
                  <ul className="ws-sum-list">
                    {payload.key_points.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {payload?.gaps && payload.gaps.length > 0 ? (
                <Section title="Evidence gaps" tone="warn">
                  <ul className="ws-sum-list">
                    {payload.gaps.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {payload?.risk_flags && payload.risk_flags.length > 0 ? (
                <Section title="Risk flags" tone="warn">
                  <ul className="ws-sum-list">
                    {payload.risk_flags.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {payload?.review_flags && payload.review_flags.length > 0 ? (
                <Section title="Review flags">
                  <ul className="ws-sum-list">
                    {payload.review_flags.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {doc.summaryFocus ? (
                <Section title="Focus used">
                  <p className="ws-doc-modal-p">{doc.summaryFocus}</p>
                </Section>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

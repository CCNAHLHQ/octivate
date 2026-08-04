"use client";

import { BookOpen } from "lucide-react";
import { openWorkspaceIntro } from "@/components/onboarding/workspace-intro-modal";
import { openOperatorIntro } from "@/components/onboarding/operator-intro-modal";
import { cn } from "@/lib/utils";

export function WorkspaceTutorialButton({
  variant = "inline",
  className,
  label = "Tutorial",
  onClick,
  mode = "workspace",
}: {
  variant?: "inline" | "fab" | "sidebar";
  className?: string;
  label?: string;
  onClick?: () => void;
  mode?: "workspace" | "operator";
}) {
  const onOpen = () => {
    if (mode === "operator") openOperatorIntro();
    else openWorkspaceIntro();
    onClick?.();
  };

  const kicker = mode === "operator" ? "Operator" : "Help";

  if (variant === "fab") {
    return (
      <button
        type="button"
        className={cn("ws-tutorial-fab", className)}
        onClick={onOpen}
        aria-label={mode === "operator" ? "Open operator tutorial" : "Open workspace tutorial"}
      >
        <span className="ws-tutorial-fab-icon" aria-hidden>
          <BookOpen className="h-4 w-4" />
        </span>
        <span className="ws-tutorial-fab-copy">
          <span className="ws-tutorial-fab-label">{mode === "operator" ? "Operator" : "Workspace"}</span>
          <span className="ws-tutorial-fab-title">Tutorial</span>
        </span>
      </button>
    );
  }

  if (variant === "sidebar") {
    return (
      <button type="button" className={cn("ws-tutorial-sidebar", className)} onClick={onOpen}>
        <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="ws-tutorial-sidebar-copy">
          <span className="ws-tutorial-sidebar-kicker">{kicker}</span>
          <span className="ws-tutorial-sidebar-label">{label}</span>
        </span>
      </button>
    );
  }

  return (
    <button type="button" className={cn("ws-tutorial-inline", className)} onClick={onOpen}>
      <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="ws-tutorial-inline-label">{label}</span>
    </button>
  );
}

"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gauge, Layers, Sparkles, Zap } from "lucide-react";
import { useT } from "@/components/i18n/locale-provider";
import type { AnalysisDepth } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEPTHS: AnalysisDepth[] = ["rapid", "standard", "deep_dive"];

const DEPTH_META: Record<
  AnalysisDepth,
  { icon: typeof Zap; accent: string; glow: string }
> = {
  rapid: {
    icon: Zap,
    accent: "#3dff9a",
    glow: "rgba(61, 255, 154, 0.35)",
  },
  standard: {
    icon: Gauge,
    accent: "#3d9bff",
    glow: "rgba(61, 155, 255, 0.38)",
  },
  deep_dive: {
    icon: Layers,
    accent: "#c45cff",
    glow: "rgba(196, 92, 255, 0.4)",
  },
};

export function AnalysisDepthControls({
  value,
  onChange,
  onSubmitBusy,
  submitLabel,
  busyLabel,
  disabled = false,
  showDepth = true,
}: {
  value: AnalysisDepth;
  onChange: (next: AnalysisDepth) => void;
  onSubmitBusy: boolean;
  submitLabel: string;
  busyLabel: string;
  disabled?: boolean;
  showDepth?: boolean;
}) {
  const t = useT();
  const groupId = useId();
  const [flash, setFlash] = useState(0);
  const [pressed, setPressed] = useState(false);
  const meta = DEPTH_META[value];
  const RunIcon = meta.icon;

  useEffect(() => {
    setFlash((n) => n + 1);
  }, [value]);

  const hint =
    value === "rapid"
      ? t("ws.project.depth.rapidHint")
      : value === "deep_dive"
        ? t("ws.project.depth.deepHint")
        : t("ws.project.depth.standardHint");

  const shortLabel = (d: AnalysisDepth) =>
    d === "rapid"
      ? t("ws.project.depth.rapidShort")
      : d === "deep_dive"
        ? t("ws.project.depth.deepShort")
        : t("ws.project.depth.standardShort");

  const depthStyle = {
    ["--depth-accent" as string]: meta.accent,
    ["--depth-glow" as string]: meta.glow,
  } as CSSProperties;

  return (
    <div className="ws-depth-controls">
      {showDepth ? (
        <div className="ws-depth-block">
          <div className="ws-depth-heading">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            <span>{t("ws.project.analysisDepth")}</span>
          </div>

          <div
            className="ws-depth-track"
            role="radiogroup"
            aria-label={t("ws.project.analysisDepth")}
            data-depth={value}
            style={depthStyle}
          >
            <motion.div
              key={`glow-${flash}`}
              className="ws-depth-track-glow"
              initial={{ opacity: 0.15, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden
            />

            {DEPTHS.map((depth) => {
              const active = value === depth;
              const Icon = DEPTH_META[depth].icon;
              return (
                <button
                  key={depth}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled}
                  className={cn("ws-depth-option", active && "is-active")}
                  onClick={() => {
                    if (disabled || depth === value) return;
                    onChange(depth);
                  }}
                >
                  {active ? (
                    <motion.span
                      layoutId={`${groupId}-pill`}
                      className="ws-depth-pill"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    />
                  ) : null}
                  <span className="ws-depth-option-inner">
                    <Icon className="ws-depth-option-icon" aria-hidden />
                    <span className="ws-depth-option-label">{shortLabel(depth)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={value}
              className="ws-depth-hint"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.28 }}
            >
              {hint}
            </motion.p>
          </AnimatePresence>
        </div>
      ) : null}

      <div className="ws-depth-run-wrap">
        <motion.button
          type="submit"
          className={cn("ws-depth-run", onSubmitBusy && "is-busy")}
          disabled={disabled || onSubmitBusy}
          data-tour="run-workflow"
          style={depthStyle}
          whileHover={disabled || onSubmitBusy ? undefined : { scale: 1.015, y: -1 }}
          whileTap={disabled || onSubmitBusy ? undefined : { scale: 0.985 }}
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => setPressed(false)}
          onMouseLeave={() => setPressed(false)}
          animate={
            pressed
              ? { boxShadow: `0 0 0 3px ${meta.glow}` }
              : { boxShadow: `0 14px 36px -10px ${meta.glow}` }
          }
          transition={{ duration: 0.2 }}
        >
          <span className="ws-depth-run-chroma" aria-hidden />
          <span className="ws-depth-run-label">
            {onSubmitBusy ? busyLabel : submitLabel}
          </span>
          {onSubmitBusy ? (
            <motion.span
              className="ws-depth-run-orb"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
              aria-hidden
            />
          ) : (
            <RunIcon className="ws-depth-run-icon" aria-hidden />
          )}
        </motion.button>
      </div>
    </div>
  );
}

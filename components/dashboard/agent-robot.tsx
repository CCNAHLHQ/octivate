"use client";

import { motion } from "framer-motion";
import { ProgressBar } from "@/components/ui/progress";
import type { AgentSession } from "@/lib/types";

type RobotState = "idle" | "working" | "done" | "failed";

const ACCENT: Record<
  RobotState,
  { ring: string; glow: string; eye: string; face: string; label: string }
> = {
  idle: {
    ring: "rgba(45,212,191,0.4)",
    glow: "rgba(45,212,191,0.22)",
    eye: "#7dede0",
    face: "#2dd4bf",
    label: "Standby",
  },
  working: {
    ring: "rgba(168,85,247,0.5)",
    glow: "rgba(168,85,247,0.35)",
    eye: "#c4a5ff",
    face: "#8b5cf6",
    label: "Working",
  },
  done: {
    ring: "rgba(45,212,191,0.5)",
    glow: "rgba(45,212,191,0.3)",
    eye: "#7dede0",
    face: "#2dd4bf",
    label: "Complete",
  },
  failed: {
    ring: "rgba(255,107,91,0.5)",
    glow: "rgba(255,107,91,0.3)",
    eye: "#ffb3a8",
    face: "#ff6b5b",
    label: "Halted",
  },
};

function RobotHead({
  state,
  colors,
  working,
}: {
  state: RobotState;
  colors: (typeof ACCENT)[RobotState];
  working: boolean;
}) {
  const soft = state === "idle";
  return (
    <motion.svg
      width="80"
      height="70"
      viewBox="0 0 80 70"
      fill="none"
      aria-hidden
      animate={working || soft ? { y: [0, -2.5, 0] } : { y: 0 }}
      transition={{
        duration: soft ? 3.2 : 2.2,
        repeat: working || soft ? Infinity : 0,
        ease: "easeInOut",
      }}
    >
      <line x1="40" y1="5" x2="40" y2="14" stroke={colors.face} strokeWidth="2" strokeLinecap="round" />
      <motion.circle
        cx="40"
        cy="5"
        r="3.2"
        fill={colors.face}
        animate={working ? { opacity: [1, 0.25, 1] } : soft ? { opacity: [0.55, 1, 0.55] } : { opacity: 1 }}
        transition={{ duration: soft ? 2.4 : 1, repeat: working || soft ? Infinity : 0 }}
      />
      <rect
        x="14"
        y="14"
        width="52"
        height="42"
        rx="13"
        fill="rgba(10,14,28,0.9)"
        stroke={colors.ring}
        strokeWidth="2"
      />
      <rect x="8" y="28" width="6" height="14" rx="3" fill={colors.face} opacity="0.8" />
      <rect x="66" y="28" width="6" height="14" rx="3" fill={colors.face} opacity="0.8" />
      <motion.g
        animate={working ? { x: [-3, 3, -3] } : soft ? { x: [-1.5, 1.5, -1.5] } : { x: 0 }}
        transition={{
          duration: working ? 1.9 : 4,
          repeat: working || soft ? Infinity : 0,
          ease: "easeInOut",
        }}
      >
        {state === "failed" ? (
          <>
            <path d="M29 30 l6 6 M35 30 l-6 6" stroke={colors.eye} strokeWidth="2.5" strokeLinecap="round" />
            <path d="M45 30 l6 6 M51 30 l-6 6" stroke={colors.eye} strokeWidth="2.5" strokeLinecap="round" />
          </>
        ) : (
          <>
            <motion.circle
              cx="33"
              cy="33"
              r="4"
              fill={colors.eye}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              animate={{ scaleY: [1, 1, 0.1, 1] }}
              transition={{ duration: soft ? 4.2 : 3.4, times: [0, 0.9, 0.94, 1], repeat: Infinity }}
            />
            <motion.circle
              cx="47"
              cy="33"
              r="4"
              fill={colors.eye}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              animate={{ scaleY: [1, 1, 0.1, 1] }}
              transition={{ duration: soft ? 4.2 : 3.4, times: [0, 0.9, 0.94, 1], repeat: Infinity }}
            />
          </>
        )}
      </motion.g>
      {state === "done" ? (
        <path d="M31 44 Q40 52 49 44" stroke={colors.eye} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      ) : state === "failed" ? (
        <path d="M31 49 Q40 42 49 49" stroke={colors.eye} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      ) : state === "idle" ? (
        <path d="M33 46 Q40 49 47 46" stroke={colors.eye} strokeWidth="2" fill="none" strokeLinecap="round" />
      ) : (
        <motion.rect
          x="32"
          y="45"
          width="16"
          height="3"
          rx="1.5"
          fill={colors.eye}
          animate={{ width: [16, 8, 16], x: [32, 36, 32] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </motion.svg>
  );
}

export function AgentRobot({
  session,
  documentCount = 0,
  idleHint,
}: {
  session?: AgentSession | null;
  documentCount?: number;
  /** Shown when no session — tailored standby copy. */
  idleHint?: string;
}) {
  const stages = session?.stages ?? [];
  const total = stages.length || 8;
  const doneCount = stages.filter((s) => s.status === "completed").length;
  const runningIdx = stages.findIndex((s) => s.status === "running");
  const failedIdx = stages.findIndex((s) => s.status === "failed");

  const state: RobotState = !session
    ? "idle"
    : session.status === "failed"
      ? "failed"
      : session.status === "completed"
        ? "done"
        : session.status === "running"
          ? "working"
          : "idle";

  const working = state === "working";
  const c = ACCENT[state];

  const runningFraction = runningIdx >= 0 ? stages[runningIdx].progress / 100 : 0;
  const overall =
    state === "done"
      ? 100
      : state === "idle"
        ? 0
        : Math.round(((doneCount + runningFraction) / total) * 100);

  const currentIdx =
    state === "done"
      ? Math.max(total - 1, 0)
      : runningIdx >= 0
        ? runningIdx
        : failedIdx >= 0
          ? failedIdx
          : Math.min(doneCount, Math.max(total - 1, 0));
  const current = stages[currentIdx];

  const status = (() => {
    if (state === "idle") {
      return (
        idleHint ||
        (documentCount > 0
          ? `Standing by with ${documentCount} document${documentCount > 1 ? "s" : ""} ready — submit a question or run a topic template.`
          : "Standing by — pick a topic starter or ask a strategic question to begin analysis.")
      );
    }
    if (state === "done") return "Analysis complete — your decision brief is ready to view.";
    if (state === "failed")
      return stages[failedIdx]?.message || "The workflow stopped before completing. Rerun to try again.";
    const running = runningIdx >= 0 ? stages[runningIdx].message : undefined;
    const lastDone = [...stages].reverse().find((s) => s.status === "completed" && s.message)?.message;
    return running || lastDone || "Spinning up the agent workflow…";
  })();

  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4"
      style={{
        borderColor: c.ring,
        background: "linear-gradient(160deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))",
      }}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-12 left-1/2 h-36 w-36 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: c.glow }}
        animate={
          working
            ? { opacity: [0.5, 0.9, 0.5], scale: [0.9, 1.1, 0.9] }
            : { opacity: [0.35, 0.6, 0.35], scale: [0.95, 1.05, 0.95] }
        }
        transition={{ duration: working ? 2.6 : 3.8, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex flex-col items-center gap-2.5 text-center">
        <div className="flex h-3 items-center gap-1">
          {(working || state === "idle") &&
            [0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: c.face }}
                animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
                transition={{ duration: state === "idle" ? 1.4 : 0.9, repeat: Infinity, delay: i * 0.16 }}
              />
            ))}
        </div>

        <RobotHead state={state} colors={c} working={working} />

        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-faint">
            {state === "idle" ? "Agent ready" : `Step ${Math.min(currentIdx + 1, total)} of ${total}`}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-foam">
            {state === "idle" ? "Doctrine agent" : current?.label ?? "Workflow"}
          </div>
        </div>

        <motion.p
          key={status}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="min-h-[2.5rem] max-w-[38ch] text-[13px] leading-snug text-mist line-clamp-3"
        >
          {status}
        </motion.p>

        {documentCount > 0 && (working || state === "idle") && (
          <div className="font-mono text-[10px] uppercase tracking-wider text-faint">
            {documentCount} document{documentCount > 1 ? "s" : ""} on deck
          </div>
        )}

        <div className="mt-1 w-full">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-faint">
            <span>{c.label}</span>
            <span>{overall}%</span>
          </div>
          <ProgressBar value={overall} pulse={working} />
        </div>
      </div>
    </div>
  );
}

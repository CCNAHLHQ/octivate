"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { HeroDottedGlobe } from "@/components/landing/hero-dotted-globe";
import { HERO_VIDEO_SRC } from "@/components/landing/hero-video-backdrop";
import type { AgentSession } from "@/lib/types";
import "@/app/phase1-landing.css";
import "@/app/hero-globe.css";

type RobotState = "idle" | "working" | "done" | "failed";

const ACCENT: Record<
  RobotState,
  { ring: string; glow: string; label: string }
> = {
  idle: {
    ring: "rgba(45,212,191,0.45)",
    glow: "rgba(45,212,191,0.22)",
    label: "Standby",
  },
  working: {
    ring: "rgba(168,85,247,0.5)",
    glow: "rgba(168,85,247,0.28)",
    label: "Working",
  },
  done: {
    ring: "rgba(45,212,191,0.55)",
    glow: "rgba(45,212,191,0.28)",
    label: "Complete",
  },
  failed: {
    ring: "rgba(255,107,91,0.5)",
    glow: "rgba(255,107,91,0.28)",
    label: "Halted",
  },
};

function PipelineVideoPlate() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    const markReady = () => {
      if (!cancelled) setReady(true);
    };
    const tryPlay = () => {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      const p = video.play();
      if (p && typeof p.catch === "function") p.catch(() => undefined);
    };
    video.addEventListener("loadeddata", markReady);
    video.addEventListener("playing", markReady);
    video.addEventListener("canplay", tryPlay);
    tryPlay();
    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("playing", markReady);
      video.removeEventListener("canplay", tryPlay);
      video.pause();
    };
  }, []);

  return (
    <div className="ws-pipe-video" data-ready={ready ? "1" : "0"} aria-hidden>
      <video
        ref={videoRef}
        className="ws-pipe-video-el"
        src={HERO_VIDEO_SRC}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        tabIndex={-1}
      />
      <div className="ws-pipe-video-blur" />
      <div className="ws-pipe-video-scrim" />
    </div>
  );
}

function ChromaticSpinner({
  overall,
  working,
  label,
}: {
  overall: number;
  working: boolean;
  label: string;
}) {
  const deg = Math.max(0, Math.min(100, overall)) * 3.6;
  return (
    <div
      className="ws-pipe-spin"
      data-working={working ? "1" : "0"}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={overall}
      aria-label={`${label} ${overall}%`}
    >
      <div className="ws-pipe-spin-ring" style={{ ["--pct" as string]: `${deg}deg` }}>
        <div className="ws-pipe-spin-chroma" aria-hidden />
        <div className="ws-pipe-spin-orbit" aria-hidden />
        <div className="ws-pipe-spin-core">
          <span className="ws-pipe-spin-pct">{overall}%</span>
          <span className="ws-pipe-spin-label">{label}</span>
        </div>
      </div>
    </div>
  );
}

export function AgentRobot({
  session,
  documentCount = 0,
  idleHint,
}: {
  session?: AgentSession | null;
  documentCount?: number;
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
      className="ws-pipe-stage"
      style={{ borderColor: c.ring }}
      data-state={state}
    >
      <PipelineVideoPlate />

      <div className="ws-pipe-body">
        <div className="ws-pipe-globe" aria-hidden>
          <HeroDottedGlobe />
        </div>

        <div className="ws-pipe-copy">
          <div className="ws-pipe-kicker">
            {state === "idle" ? "Agent ready" : `Step ${Math.min(currentIdx + 1, total)} of ${total}`}
          </div>
          <div className="ws-pipe-title">
            {state === "idle" ? "Doctrine agent" : current?.label ?? "Workflow"}
          </div>

          <motion.p
            key={status}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="ws-pipe-status"
          >
            {status}
          </motion.p>

          {documentCount > 0 && (working || state === "idle") && (
            <div className="ws-pipe-docs">
              {documentCount} document{documentCount > 1 ? "s" : ""} on deck
            </div>
          )}

          <ChromaticSpinner overall={overall} working={working} label={c.label} />
        </div>
      </div>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import type { JobProgressSnapshot } from "@/lib/sources/job-progress";
import { cn } from "@/lib/utils";

export function OperatorJobProgress({
  job,
  active,
  tone = "teal",
  idleLabel,
}: {
  job: JobProgressSnapshot | null | undefined;
  active: boolean;
  tone?: "teal" | "amber";
  idleLabel?: string;
}) {
  const running = active || job?.status === "running";
  const justFinished =
    !active && (job?.status === "done" || job?.status === "error") && !!job?.finishedAt;

  if (!running && !justFinished) return null;

  const total = job?.total ?? 0;
  const done = job?.done ?? 0;
  const pct =
    total > 0
      ? Math.max(running ? 4 : 0, Math.min(100, Math.round((done / total) * 100)))
      : running
        ? 12
        : 100;

  const label =
    job?.label ||
    (running ? idleLabel || "Working…" : job?.status === "error" ? "Failed" : "Complete");

  const count =
    total > 0 ? `${Math.min(done, total)} / ${total}` : running ? "…" : done ? `${done}` : "";

  return (
    <div
      className={cn(
        "op-src-job-progress",
        `is-${tone}`,
        running && "is-active",
        job?.status === "error" && "is-error",
        justFinished && !running && "is-finished"
      )}
      role="status"
      aria-live="polite"
      aria-busy={running}
    >
      <div className="op-src-job-progress-meta">
        <span className="op-src-job-progress-label">{label}</span>
        {count ? <span className="op-src-job-progress-count">{count}</span> : null}
      </div>
      <div className="op-src-job-progress-track">
        <motion.div
          className="op-src-job-progress-fill"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      {running && job?.current ? (
        <p className="op-src-job-progress-current" title={job.current}>
          {job.current}
        </p>
      ) : null}
    </div>
  );
}

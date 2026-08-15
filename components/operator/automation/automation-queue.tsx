"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Loader2,
} from "lucide-react";
import type { AutoJob } from "./types";

export function AutomationQueue({
  jobs,
  page,
  totalPages,
  total,
  busyId,
  onPage,
  onView,
  onDownload,
}: {
  jobs: AutoJob[];
  page: number;
  totalPages: number;
  total: number;
  busyId: string | null;
  onPage: (p: number) => void;
  onView: (id: string) => void;
  onDownload: (id: string) => void;
}) {
  return (
    <section className="op-auto2-queue" aria-label="Queue">
      <div className="op-auto2-queue-head">
        <h3>Queue</h3>
        <span>
          {total} job{total === 1 ? "" : "s"}
        </span>
      </div>

      <ul className="op-auto2-rows">
        {jobs.length === 0 ? (
          <li className="op-auto2-empty">No jobs yet. Start a batch to fill the queue.</li>
        ) : (
          jobs.map((j) => (
            <QueueRow
              key={j.id}
              job={j}
              busy={busyId === j.id}
              onView={() => onView(j.id)}
              onDownload={() => onDownload(j.id)}
            />
          ))
        )}
      </ul>

      {totalPages > 1 ? (
        <div className="op-auto2-pager">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span>
            {page}/{totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

function QueueRow({
  job,
  busy,
  onView,
  onDownload,
}: {
  job: AutoJob;
  busy: boolean;
  onView: () => void;
  onDownload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const done = job.stage === "done";
  const failed = job.stage === "failed";

  return (
    <li className="op-auto2-row" data-stage={job.stage}>
      <div className="op-auto2-row-main">
        <div className="op-auto2-row-title">
          <strong title={job.title}>{job.title}</strong>
          <span>
            {job.country}
            {job.asrProvider || job.model
              ? ` · ${job.asrProvider || ""}${job.model ? ` ${job.model}` : ""}`
              : ""}
          </span>
        </div>
        <span className="op-auto2-stage" data-stage={job.stage}>
          {job.stage}
        </span>
        <div className="op-auto2-prog" title={job.progressLabel || undefined}>
          <div style={{ width: `${Math.max(0, Math.min(100, job.progressPct))}%` }} />
        </div>
        <div className="op-auto2-row-acts">
          <button
            type="button"
            disabled={!done || busy}
            onClick={onView}
            aria-label="View transcript"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            disabled={!done || busy}
            onClick={onDownload}
            aria-label="Download transcript"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {(failed || job.error) && (
        <button
          type="button"
          className="op-auto2-err-toggle"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide error" : job.error || "Error details"}
        </button>
      )}
      {open && (job.errorDetail || job.error) ? (
        <pre className="op-auto2-err">{job.errorDetail || job.error}</pre>
      ) : null}
    </li>
  );
}

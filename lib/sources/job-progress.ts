export type JobKind = "probe" | "capture";

export type JobProgressSnapshot = {
  kind: JobKind;
  status: "idle" | "running" | "done" | "error";
  mode?: string;
  label?: string;
  total: number;
  done: number;
  failed: number;
  succeeded: number;
  current?: string;
  startedAt?: string;
  updatedAt: string;
  finishedAt?: string;
};

function empty(kind: JobKind): JobProgressSnapshot {
  return {
    kind,
    status: "idle",
    total: 0,
    done: 0,
    failed: 0,
    succeeded: 0,
    updatedAt: new Date().toISOString(),
  };
}

const jobs: Record<JobKind, JobProgressSnapshot> = {
  probe: empty("probe"),
  capture: empty("capture"),
};

function touch(kind: JobKind, patch: Partial<JobProgressSnapshot>) {
  jobs[kind] = {
    ...jobs[kind],
    ...patch,
    kind,
    updatedAt: new Date().toISOString(),
  };
  return jobs[kind];
}

export function beginJob(
  kind: JobKind,
  opts: { total: number; mode?: string; label?: string; current?: string }
): JobProgressSnapshot {
  return touch(kind, {
    status: "running",
    mode: opts.mode,
    label: opts.label,
    total: Math.max(0, opts.total),
    done: 0,
    failed: 0,
    succeeded: 0,
    current: opts.current,
    startedAt: new Date().toISOString(),
    finishedAt: undefined,
  });
}

/** Continue an in-flight job across capture waves without resetting the bar. */
export function ensureJob(
  kind: JobKind,
  opts: { total: number; mode?: string; label?: string; current?: string }
): JobProgressSnapshot {
  const cur = jobs[kind];
  if (cur.status === "running") {
    return touch(kind, {
      mode: opts.mode ?? cur.mode,
      label: opts.label ?? cur.label,
      total: Math.max(cur.total, Math.max(0, opts.total)),
      current: opts.current ?? cur.current,
      finishedAt: undefined,
    });
  }
  return beginJob(kind, opts);
}

export function setJobCurrent(kind: JobKind, current: string): JobProgressSnapshot {
  return touch(kind, { current, status: "running" });
}

/** Mark one unit complete (safe under concurrent probe workers). */
export function advanceJob(
  kind: JobKind,
  opts?: { ok?: boolean; current?: string }
): JobProgressSnapshot {
  const prev = jobs[kind];
  const ok = opts?.ok !== false;
  return touch(kind, {
    status: "running",
    done: prev.done + 1,
    succeeded: prev.succeeded + (ok ? 1 : 0),
    failed: prev.failed + (ok ? 0 : 1),
    current: opts?.current ?? prev.current,
  });
}

export function endJob(
  kind: JobKind,
  opts?: { error?: boolean; label?: string }
): JobProgressSnapshot {
  return touch(kind, {
    status: opts?.error ? "error" : "done",
    label: opts?.label ?? jobs[kind].label,
    current: undefined,
    finishedAt: new Date().toISOString(),
  });
}

export function getJobProgress(kind: JobKind): JobProgressSnapshot {
  return { ...jobs[kind] };
}

export function getAllJobProgress(): {
  probe: JobProgressSnapshot;
  capture: JobProgressSnapshot;
} {
  return {
    probe: getJobProgress("probe"),
    capture: getJobProgress("capture"),
  };
}

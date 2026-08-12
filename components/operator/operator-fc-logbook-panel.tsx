"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenCheck,
  CalendarDays,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  Rocket,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { OperatorSection } from "@/components/operator/operator-section";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { FcLogbookJob, FcSyncMode } from "@/lib/future-caribbean/types";

type DaySummary = {
  key: string;
  weekLabel: string;
  title: string;
  screenshot?: string;
  chars: number;
  isToday?: boolean;
  isYesterday?: boolean;
};

type WeekSummary = {
  label: string;
  days: DaySummary[];
};

type FcStatusResponse = {
  publishTarget: string;
  publishTargetLabel: string;
  credentialsConfigured: boolean;
  plannedDays: number;
  todayKey: string;
  yesterdayKey: string;
  recentKeys: string[];
  recentDays: DaySummary[];
  weeks: WeekSummary[];
  days: DaySummary[];
  job: FcLogbookJob;
};

const AUTO_FLAG = "octivate.fc.autoRecent.v1";

function stepTone(status: string): "teal" | "info" | "coral" | "amber" | "mist" {
  if (status === "done") return "teal";
  if (status === "running") return "info";
  if (status === "error") return "coral";
  if (status === "skipped") return "amber";
  return "mist";
}

function dayStatus(
  key: string,
  job?: FcLogbookJob
): "present" | "needs" | "locked" | "unknown" {
  const row = job?.check?.days?.find((d) => d.key === key);
  if (!row) return "unknown";
  if (row.disabled) return "locked";
  if (row.present) return "present";
  if (row.needsPublish) return "needs";
  return "unknown";
}

function statusLabel(s: ReturnType<typeof dayStatus>) {
  if (s === "present") return "Present";
  if (s === "needs") return "Needs upload";
  if (s === "locked") return "Locked";
  return "Not checked";
}

export function OperatorFcLogbookPanel() {
  const [data, setData] = useState<FcStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekLabel, setWeekLabel] = useState<string>("");
  const [autoUpload, setAutoUpload] = useState(true);
  const autoTried = useRef(false);

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true);
    try {
      const res = await apiFetch<FcStatusResponse>("/api/operator/fc-logbook", {
        skipCache: true,
      });
      setData(res);
      setError(null);
      setWeekLabel((prev) => {
        if (prev && res.weeks.some((w) => w.label === prev)) return prev;
        const withRecent = res.weeks.find((w) =>
          w.days.some((d) => d.isToday || d.isYesterday)
        );
        return withRecent?.label || res.weeks[res.weeks.length - 1]?.label || "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load publisher status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (data?.job.status !== "running") return;
    const t = window.setInterval(() => {
      void load(true);
    }, 1600);
    return () => window.clearInterval(t);
  }, [data?.job.status, load]);

  const publish = useCallback(
    async (mode: FcSyncMode, auto = false) => {
      setStarting(true);
      setError(null);
      try {
        await apiFetch("/api/operator/fc-logbook", {
          method: "POST",
          json: { mode, auto },
        });
        invalidateApiCache("/api/operator/fc-logbook");
        await load(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Publish failed to start");
      } finally {
        setStarting(false);
      }
    },
    [load]
  );

  // Auto-upload yesterday & today once per browser session when enabled.
  useEffect(() => {
    if (!data || autoTried.current || !autoUpload) return;
    if (!data.credentialsConfigured) return;
    if (data.job.status === "running" || starting) return;
    if (!data.recentDays.length) return;
    try {
      if (sessionStorage.getItem(AUTO_FLAG) === "1") {
        autoTried.current = true;
        return;
      }
    } catch {
      /* private mode */
    }
    autoTried.current = true;
    try {
      sessionStorage.setItem(AUTO_FLAG, "1");
    } catch {
      /* ignore */
    }
    void publish("recent", true);
  }, [data, autoUpload, starting, publish]);

  const job = data?.job;
  const running = job?.status === "running" || starting;
  const check = job?.check;
  const pct = running && (job?.progress.pct || 0) < 4 ? 4 : job?.progress.pct || 0;

  const selectedWeek = useMemo(
    () => data?.weeks.find((w) => w.label === weekLabel) || data?.weeks[data.weeks.length - 1],
    [data, weekLabel]
  );

  const recentCards = useMemo(() => {
    const keys = data?.recentKeys || [];
    return keys.map((key) => {
      const day = data?.days.find((d) => d.key === key);
      const status = dayStatus(key, job);
      return {
        key,
        day,
        status,
        kind: key === data?.todayKey ? "today" : "yesterday",
      };
    });
  }, [data, job]);

  return (
    <OperatorSection
      id="fc-logbook-publisher"
      icon={BookOpenCheck}
      title="Future Caribbean Logbook"
      description="Shemuel · Open Track publisher. Focus yesterday & today, browse older weeks from the dropdown, and auto-upload new entries when you open Operations."
      actions={
        <div className="op-fc-actions">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void load()}
            disabled={loading || running}
            aria-label="Refresh publisher status"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void publish("missing")}
            disabled={running || !data?.credentialsConfigured}
            aria-label="Publish all missing logbook days"
          >
            All missing
          </Button>
          <Button
            size="sm"
            onClick={() => void publish("recent")}
            disabled={running || !data?.credentialsConfigured || !data?.recentDays.length}
            aria-label="Upload yesterday and today"
          >
            {running && (job?.mode === "recent" || !job?.mode) ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Rocket className="h-3.5 w-3.5" />
            )}
            {running && job?.mode === "recent" ? "Uploading…" : "Upload yesterday & today"}
          </Button>
        </div>
      }
    >
      <div className="op-fc-panel">
        <div className="op-fc-top">
          <div className="op-fc-target" role="status">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            <div>
              <p className="op-fc-target-label">Publishing destination</p>
              <a
                className="op-fc-target-link"
                href={data?.publishTarget || "https://os.futurecaribbean.com/builder/logbook"}
                target="_blank"
                rel="noreferrer"
              >
                {data?.publishTargetLabel || "Future Caribbean Builder · Logbook"}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </div>
          </div>

          <label className="op-fc-auto">
            <input
              type="checkbox"
              checked={autoUpload}
              onChange={(e) => {
                const on = e.target.checked;
                setAutoUpload(on);
                if (!on) {
                  try {
                    sessionStorage.setItem(AUTO_FLAG, "1");
                  } catch {
                    /* ignore */
                  }
                } else {
                  try {
                    sessionStorage.removeItem(AUTO_FLAG);
                  } catch {
                    /* ignore */
                  }
                  autoTried.current = false;
                }
              }}
              disabled={running}
            />
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Auto-upload yesterday & today on open
          </label>
        </div>

        <div className="op-fc-stats" aria-label="Planned journey summary">
          <span className="op-src-pulse-chip is-violet">
            <BookOpenCheck className="h-3 w-3" aria-hidden />
            {data?.plannedDays ?? "—"} planned days
          </span>
          {check ? (
            <>
              <span className="op-src-pulse-chip is-teal">{check.present} present</span>
              <span className="op-src-pulse-chip is-amber">{check.missing} need publish</span>
              <span className="op-src-pulse-chip">{check.disabled} locked</span>
            </>
          ) : (
            <span className="op-src-pulse-chip">Upload recent to inventory remote days</span>
          )}
          {!data?.credentialsConfigured ? (
            <span className="op-src-pulse-chip is-coral">
              Set FC_LOGBOOK_EMAIL / FC_LOGBOOK_PASSWORD in .env
            </span>
          ) : null}
          {job?.auto ? (
            <span className="op-src-pulse-chip is-violet">Auto run</span>
          ) : null}
        </div>

        <div className="op-fc-recent" aria-label="Yesterday and today">
          {recentCards.map((card) => (
            <article
              key={card.key}
              className={cn(
                "op-fc-recent-card",
                card.kind === "today" && "is-today",
                card.status === "needs" && "is-needs",
                card.status === "present" && "is-present"
              )}
            >
              <header>
                <span className="op-fc-recent-kind">
                  {card.kind === "today" ? "Today" : "Yesterday"}
                </span>
                <StatusBadge
                  tone={
                    card.status === "present"
                      ? "teal"
                      : card.status === "needs"
                        ? "amber"
                        : card.status === "locked"
                          ? "coral"
                          : "mist"
                  }
                >
                  {statusLabel(card.status)}
                </StatusBadge>
              </header>
              <p className="op-fc-recent-key">{card.key}</p>
              <p className="op-fc-recent-title">
                {card.day?.title || "No planned entry for this day yet"}
              </p>
              {card.day?.screenshot ? (
                <a href={card.day.screenshot} target="_blank" rel="noreferrer">
                  Evidence URL
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : null}
            </article>
          ))}
        </div>

        <div className="op-fc-progress">
          <div className="op-fc-progress-meta">
            <span>{job?.progress.label || "Ready"}</span>
            <span>
              {job?.progress.done ?? 0}/{job?.progress.total ?? 4}
              {job?.mode ? ` · ${job.mode}` : ""}
            </span>
          </div>
          <ProgressBar value={pct} pulse={running} />
        </div>

        <details className="op-fc-steps-wrap" open={running}>
          <summary>Pipeline steps</summary>
          <ol className="op-fc-steps">
            {(job?.steps || []).map((step, idx) => (
              <li key={step.id} className={cn("op-fc-step", `is-${step.status}`)}>
                <span className="op-fc-step-idx">{idx + 1}</span>
                <div className="op-fc-step-body">
                  <div className="op-fc-step-top">
                    <p>{step.label}</p>
                    <StatusBadge tone={stepTone(step.status)}>{step.status}</StatusBadge>
                  </div>
                  {step.detail ? <p className="op-fc-step-detail">{step.detail}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </details>

        {error ? <p className="op-fc-error">{error}</p> : null}
        {job?.error ? <p className="op-fc-error">{job.error}</p> : null}

        {data?.weeks?.length ? (
          <div className="op-fc-browse">
            <div className="op-fc-browse-head">
              <label className="op-fc-week-label" htmlFor="fc-week-select">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                Browse week
              </label>
              <Select
                id="fc-week-select"
                compact
                value={weekLabel}
                onChange={(e) => setWeekLabel(e.target.value)}
                aria-label="Select logbook week"
              >
                {data.weeks.map((w) => (
                  <option key={w.label} value={w.label}>
                    {w.label} ({w.days.length} days)
                  </option>
                ))}
              </Select>
            </div>
            <ul className="op-fc-week-days">
              {(selectedWeek?.days || []).map((d) => {
                const status = dayStatus(d.key, job);
                return (
                  <li
                    key={d.key}
                    className={cn(
                      "op-fc-week-day",
                      d.isToday && "is-today",
                      d.isYesterday && "is-yesterday"
                    )}
                  >
                    <div>
                      <span className="op-fc-week-day-key">
                        <b>{d.key}</b>
                        {d.isToday ? <em>Today</em> : null}
                        {d.isYesterday ? <em>Yesterday</em> : null}
                      </span>
                      <span className="op-fc-week-day-title">{d.title}</span>
                    </div>
                    <div className="op-fc-week-day-meta">
                      <StatusBadge
                        tone={
                          status === "present"
                            ? "teal"
                            : status === "needs"
                              ? "amber"
                              : status === "locked"
                                ? "coral"
                                : "mist"
                        }
                      >
                        {statusLabel(status)}
                      </StatusBadge>
                      {d.screenshot ? (
                        <a href={d.screenshot} target="_blank" rel="noreferrer">
                          shot
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </OperatorSection>
  );
}

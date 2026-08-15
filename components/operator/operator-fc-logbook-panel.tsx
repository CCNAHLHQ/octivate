"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpenCheck, Loader2, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import type { FcLogbookJob, FcSyncMode } from "@/lib/future-caribbean/types";

type DaySummary = {
  key: string;
  title: string;
  isToday?: boolean;
  isYesterday?: boolean;
};

type FcStatusResponse = {
  credentialsConfigured: boolean;
  recentDays: DaySummary[];
  todayKey: string;
  yesterdayKey: string;
  job: FcLogbookJob;
};

const AUTO_FLAG = "octivate.fc.autoRecent.v1";

export function OperatorFcLogbookPanel() {
  const [data, setData] = useState<FcStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load status");
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
        setError(err instanceof Error ? err.message : "Publish failed");
      } finally {
        setStarting(false);
      }
    },
    [load]
  );

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

  const yesterday = data?.recentDays.find((d) => d.key === data.yesterdayKey);
  const today = data?.recentDays.find((d) => d.key === data.todayKey);

  return (
    <section className="op-card op-basic-panel" aria-label="Logbook">
      <div className="op-basic-head">
        <h3 className="op-basic-title">
          <BookOpenCheck className="h-4 w-4" aria-hidden />
          Logbook
        </h3>
        <div className="op-basic-actions">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void load()}
            disabled={loading || running}
            aria-label="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="sm"
            onClick={() => void publish("recent")}
            disabled={running || !data?.credentialsConfigured || !data?.recentDays.length}
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {running ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </div>

      <p className="op-basic-meta">
        {!data?.credentialsConfigured
          ? "Credentials missing (FC_LOGBOOK_EMAIL / PASSWORD)"
          : check
            ? `${check.present} present · ${check.missing} missing`
            : "Ready"}
        {yesterday ? ` · yday ${yesterday.key}` : ""}
        {today ? ` · today ${today.key}` : ""}
      </p>

      <label className="op-basic-check">
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
        Auto-upload on open
      </label>

      {(running || (job?.progress.total ?? 0) > 0) && (
        <div className="op-basic-progress">
          <div className="op-basic-progress-meta">
            <span>{job?.progress.label || "Idle"}</span>
            <span>
              {job?.progress.done ?? 0}/{job?.progress.total ?? 0}
            </span>
          </div>
          <ProgressBar value={pct} pulse={running} />
        </div>
      )}

      {error ? <p className="op-basic-error">{error}</p> : null}
      {job?.error ? <p className="op-basic-error">{job.error}</p> : null}
    </section>
  );
}

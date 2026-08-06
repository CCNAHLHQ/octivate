"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpenCheck,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { OperatorSection } from "@/components/operator/operator-section";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { FcLogbookJob } from "@/lib/future-caribbean/types";

type FcStatusResponse = {
  publishTarget: string;
  publishTargetLabel: string;
  credentialsConfigured: boolean;
  plannedDays: number;
  days: Array<{
    key: string;
    weekLabel: string;
    title: string;
    screenshot?: string;
    chars: number;
  }>;
  job: FcLogbookJob;
};

function stepTone(status: string): "teal" | "info" | "coral" | "amber" | "mist" {
  if (status === "done") return "teal";
  if (status === "running") return "info";
  if (status === "error") return "coral";
  if (status === "skipped") return "amber";
  return "mist";
}

export function OperatorFcLogbookPanel() {
  const [data, setData] = useState<FcStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true);
    try {
      const res = await apiFetch<FcStatusResponse>("/api/operator/fc-logbook", {
        skipCache: true,
      });
      setData(res);
      setError(null);
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

  async function publish() {
    setStarting(true);
    setError(null);
    try {
      await apiFetch("/api/operator/fc-logbook", { method: "POST", json: {} });
      invalidateApiCache("/api/operator/fc-logbook");
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed to start");
    } finally {
      setStarting(false);
    }
  }

  const job = data?.job;
  const running = job?.status === "running" || starting;
  const check = job?.check;
  const pct = running && (job?.progress.pct || 0) < 4 ? 4 : job?.progress.pct || 0;

  return (
    <OperatorSection
      id="fc-logbook-publisher"
      icon={BookOpenCheck}
      title="Future Caribbean Logbook"
      description="Operator-only publisher for Shemuel · Open Track. Checks what is already on the competition logbook, uploads evidence screenshots to GitHub, then publishes any unaccounted days — including today."
      actions={
        <div className="flex items-center gap-1.5">
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
            onClick={() => void publish()}
            disabled={running || !data?.credentialsConfigured}
            aria-label="Publish to Future Caribbean Logbook"
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Rocket className="h-3.5 w-3.5" />
            )}
            {running ? "Publishing…" : "Publish to Future Caribbean"}
          </Button>
        </div>
      }
    >
      <div className="op-fc-panel">
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
            <p className="op-fc-target-url">{data?.publishTarget}</p>
          </div>
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
            <span className="op-src-pulse-chip">Run publish to inventory remote days</span>
          )}
          {!data?.credentialsConfigured ? (
            <span className="op-src-pulse-chip is-coral">
              Set FC_LOGBOOK_EMAIL / FC_LOGBOOK_PASSWORD in .env
            </span>
          ) : null}
        </div>

        <div className="op-fc-progress">
          <div className="op-fc-progress-meta">
            <span>{job?.progress.label || "Ready"}</span>
            <span>
              {job?.progress.done ?? 0}/{job?.progress.total ?? 4}
            </span>
          </div>
          <ProgressBar value={pct} pulse={running} />
        </div>

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

        {error ? <p className="op-fc-error">{error}</p> : null}
        {job?.error ? <p className="op-fc-error">{job.error}</p> : null}

        {data?.days?.length ? (
          <details className="op-fc-days">
            <summary>
              Planned entries with GitHub evidence URLs ({data.days.length})
            </summary>
            <ul>
              {data.days.map((d) => (
                <li key={d.key}>
                  <span>
                    <b>{d.key}</b> · {d.title}
                  </span>
                  {d.screenshot ? (
                    <a href={d.screenshot} target="_blank" rel="noreferrer">
                      screenshot
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </OperatorSection>
  );
}

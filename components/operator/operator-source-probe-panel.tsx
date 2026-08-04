"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Clock3,
  FolderArchive,
  Gauge,
  Layers,
  Loader2,
  Network,
  Play,
  Radar,
  RefreshCw,
  ShieldCheck,
  Timer,
  Hourglass,
  Trash2,
} from "lucide-react";
import { AutosaveStatusPill } from "@/components/operator/autosave-status";
import { OperatorJobProgress } from "@/components/operator/operator-job-progress";
import { OperatorSection } from "@/components/operator/operator-section";
import {
  SourceProbeProvider,
  useOptionalSourceProbe,
  useSourceProbe,
} from "@/components/operator/source-probe-context";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { IconSelect, type IconSelectOption } from "@/components/ui/icon-select";
import { Skeleton } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type NumOpt = { value: number; label: string; Icon: LucideIcon };
export type ProbePanelSection = "all" | "autocheck" | "capture";

const INTERVAL_OPTS: NumOpt[] = [
  { value: 1, label: "Every hour", Icon: Clock3 },
  { value: 2, label: "Every 2 hours", Icon: Clock3 },
  { value: 3, label: "Every 3 hours", Icon: Clock3 },
  { value: 6, label: "Every 6 hours", Icon: Clock3 },
  { value: 12, label: "Every 12 hours", Icon: Clock3 },
  { value: 24, label: "Daily", Icon: Clock3 },
  { value: 48, label: "Every 2 days", Icon: Clock3 },
  { value: 72, label: "Every 3 days", Icon: Clock3 },
  { value: 168, label: "Weekly", Icon: Clock3 },
];

const STALE_OPTS: NumOpt[] = [
  { value: 3, label: "3 hours", Icon: Hourglass },
  { value: 6, label: "6 hours", Icon: Hourglass },
  { value: 12, label: "12 hours", Icon: Hourglass },
  { value: 24, label: "24 hours", Icon: Hourglass },
  { value: 48, label: "2 days", Icon: Hourglass },
  { value: 72, label: "3 days", Icon: Hourglass },
  { value: 168, label: "1 week", Icon: Hourglass },
  { value: 336, label: "2 weeks", Icon: Hourglass },
  { value: 720, label: "30 days", Icon: Hourglass },
];

const CONCURRENCY_OPTS: NumOpt[] = [1, 2, 3, 4, 5, 6, 8].map((v) => ({
  value: v,
  label: `${v} parallel`,
  Icon: Gauge,
}));

const TIMEOUT_OPTS: NumOpt[] = [
  { value: 2000, label: "2 seconds", Icon: Timer },
  { value: 4000, label: "4 seconds", Icon: Timer },
  { value: 6000, label: "6 seconds", Icon: Timer },
  { value: 8000, label: "8 seconds", Icon: Timer },
  { value: 10000, label: "10 seconds", Icon: Timer },
  { value: 15000, label: "15 seconds", Icon: Timer },
  { value: 20000, label: "20 seconds", Icon: Timer },
  { value: 30000, label: "30 seconds", Icon: Timer },
];

const GAP_OPTS: NumOpt[] = [
  { value: 250, label: "0.25 s", Icon: Network },
  { value: 500, label: "0.5 s", Icon: Network },
  { value: 1000, label: "1 s", Icon: Network },
  { value: 1500, label: "1.5 s", Icon: Network },
  { value: 2000, label: "2 s", Icon: Network },
  { value: 3000, label: "3 s", Icon: Network },
  { value: 5000, label: "5 s", Icon: Network },
  { value: 10000, label: "10 s", Icon: Network },
];

const BATCH_OPTS: NumOpt[] = [5, 8, 12, 16, 20, 24, 30, 40].map((v) => ({
  value: v,
  label: `${v} / wave`,
  Icon: Layers,
}));

function toIconOptions(opts: NumOpt[], current: number): IconSelectOption[] {
  const list = opts.some((o) => o.value === current)
    ? opts
    : [{ value: current, label: `${current} (current)`, Icon: Clock3 }, ...opts];
  return list.map((o) => ({
    value: String(o.value),
    label: o.label,
    leading: <o.Icon aria-hidden />,
  }));
}

function ProbeIconField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: NumOpt[];
  onChange: (next: number) => void;
}) {
  const items = useMemo(() => toIconOptions(options, value), [options, value]);
  return (
    <div className="op-src-probe-field">
      <span className="op-src-probe-field-label">{label}</span>
      <IconSelect
        aria-label={label}
        value={String(value)}
        options={items}
        onChange={(v) => onChange(Number(v))}
      />
    </div>
  );
}

function ProbePolicyCard({
  icon: Icon,
  title,
  description,
  on,
  onToggle,
  badge,
  tone = "teal",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  on: boolean;
  onToggle: () => void;
  badge: { label: string; tone: "teal" | "amber" | "mist" | "violet" };
  tone?: "violet" | "teal" | "amber";
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={cn("op-policy-card op-src-probe-policy", on && "is-on", `is-${tone}`)}
      onClick={onToggle}
    >
      <div className="op-policy-card-main">
        <span className={cn("op-limit-ico", `is-${tone}`)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 text-left">
          <div className="op-policy-card-top">
            <h4 className="op-limit-title">{title}</h4>
            <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
          </div>
          <p className="op-limit-desc">{description}</p>
        </div>
      </div>
      <span className="op-toggle-track" data-on={on ? "true" : "false"} aria-hidden>
        <span className="op-toggle-thumb" />
      </span>
    </button>
  );
}

function ProbePanelBody({
  embedded,
  section,
}: {
  embedded: boolean;
  section: ProbePanelSection;
}) {
  const {
    loading,
    config,
    stats,
    capture,
    saveStatus,
    probing,
    capturing,
    probeJob,
    captureJob,
    patchConfig,
    persistNow,
    runProbe,
    runCapture,
    clearCaptures,
  } = useSourceProbe();
  const [confirmClearCaptures, setConfirmClearCaptures] = useState(false);
  const [clearingCaptures, setClearingCaptures] = useState(false);
  const pendingCaptures = capture?.pending ?? 0;

  if (loading || !config || !stats) {
    return <Skeleton className="h-28 rounded-[var(--r-md)]" />;
  }

  const issues = stats.degraded + stats.down;
  const storeLabel = capture?.artifactsRoot || "local artifact store";
  const showAuto = section === "all" || section === "autocheck";
  const showCapture = section === "all" || section === "capture";

  const autosave = (
    <AutosaveStatusPill status={saveStatus} onRetry={persistNow} />
  );

  return (
    <div className={cn("space-y-2.5", !embedded && "op-tab-panel")}>
      {showAuto ? (
        <OperatorSection
          id="source-autocheck"
          icon={Radar}
          title="Auto-check"
          description="Check stale or Check all runs on this card — watch the progress bar; no dialog to wait in."
          embedded={embedded}
          actions={autosave}
        >
          <div className="op-src-probe-kpis" aria-label="Availability summary">
            <span className="op-src-pulse-chip is-teal">
              <ShieldCheck className="h-3 w-3" />
              {stats.healthy} up
            </span>
            <span className="op-src-pulse-chip is-amber">
              <Activity className="h-3 w-3" />
              {issues} issues
            </span>
            <span className="op-src-pulse-chip">{stats.never} unchecked</span>
            <span className="op-src-pulse-chip is-violet">{stats.total} total</span>
          </div>

          <ProbePolicyCard
            icon={Radar}
            title="Enable auto-check"
            description="Stale batches ride health probes on the cadence below."
            on={config.enabled}
            onToggle={() => patchConfig("enabled", !config.enabled)}
            badge={{
              label: probing ? "Running" : config.enabled ? "Enabled" : "Paused",
              tone: probing ? "teal" : config.enabled ? "teal" : "mist",
            }}
            tone="teal"
          />

          <OperatorJobProgress
            job={probeJob}
            active={probing}
            tone="teal"
            idleLabel="Checking sources…"
          />

          <div className="op-src-probe-controls">
            <p className="op-src-probe-controls-label">Cadence</p>
            <div className="op-src-probe-grid">
              <ProbeIconField
                label="Interval"
                value={config.intervalHours}
                options={INTERVAL_OPTS}
                onChange={(intervalHours) => patchConfig("intervalHours", intervalHours)}
              />
              <ProbeIconField
                label="Stale after"
                value={config.staleAfterHours}
                options={STALE_OPTS}
                onChange={(staleAfterHours) =>
                  patchConfig("staleAfterHours", staleAfterHours)
                }
              />
              <ProbeIconField
                label="Batch size"
                value={config.batchSize}
                options={BATCH_OPTS}
                onChange={(batchSize) => patchConfig("batchSize", batchSize)}
              />
              <ProbeIconField
                label="Concurrency"
                value={config.concurrency}
                options={CONCURRENCY_OPTS}
                onChange={(concurrency) => patchConfig("concurrency", concurrency)}
              />
              <ProbeIconField
                label="Timeout"
                value={config.timeoutMs}
                options={TIMEOUT_OPTS}
                onChange={(timeoutMs) => patchConfig("timeoutMs", timeoutMs)}
              />
              <ProbeIconField
                label="Per-domain gap"
                value={config.perDomainGapMs}
                options={GAP_OPTS}
                onChange={(perDomainGapMs) => patchConfig("perDomainGapMs", perDomainGapMs)}
              />
            </div>
          </div>

          <div className="op-src-probe-actions is-end">
            <Tooltip content="Probe sources that are past the stale window">
              <Button
                size="sm"
                variant="ghost"
                disabled={probing || !config.enabled}
                onClick={() => void runProbe("stale")}
              >
                {probing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Check stale
              </Button>
            </Tooltip>
            <Tooltip content="Probe the full registry in this wave — progress stays on this card">
              <Button
                size="sm"
                variant="ghost"
                disabled={probing}
                onClick={() => void runProbe("all")}
              >
                <Radar className="h-3.5 w-3.5" />
                Check all
              </Button>
            </Tooltip>
          </div>
        </OperatorSection>
      ) : null}

      {showCapture ? (
        <OperatorSection
          id="source-capture"
          icon={FolderArchive}
          title="Source capture"
          description="Capture all queues every source. Use Resume if a run stopped with pending leftovers."
          embedded={embedded}
          actions={autosave}
        >
          <ProbePolicyCard
            icon={FolderArchive}
            title="Capture queue"
            description={
              capture?.runnerReady
                ? pendingCaptures > 0
                  ? `${pendingCaptures} pending${
                      (capture.running ?? 0) > 0
                        ? ` · ${capture.running} stuck mid-run`
                        : ""
                    } — Resume continues from the durable queue.`
                  : "Capture all saves single-page HTML + JSON bundles for the full registry."
                : "Install Microsoft Edge / Chrome or set CHROMIUM_PATH to enable the runner."
            }
            on={config.captureEnabled}
            onToggle={() => patchConfig("captureEnabled", !config.captureEnabled)}
            badge={{
              label: !capture?.runnerReady
                ? "No browser"
                : capturing
                  ? "Running"
                  : config.captureEnabled
                    ? "Ready"
                    : "Off",
              tone: !capture?.runnerReady
                ? "mist"
                : capturing
                  ? "amber"
                  : config.captureEnabled
                    ? "amber"
                    : "mist",
            }}
            tone="amber"
          />

          <div className="op-src-probe-kpis" aria-label="Capture queue summary">
            <span className="op-src-pulse-chip is-amber">
              <FolderArchive className="h-3 w-3" />
              {pendingCaptures} pending
            </span>
            <span className="op-src-pulse-chip is-teal">
              {capture?.done ?? 0} saved
            </span>
            <span className="op-src-pulse-chip">
              {capture?.failed ?? 0} failed
            </span>
          </div>

          <OperatorJobProgress
            job={captureJob}
            active={capturing}
            tone="amber"
            idleLabel="Capturing pages…"
          />

          <div className="op-src-probe-foot">
            <p className="op-src-probe-path">
              <FolderArchive className="h-3.5 w-3.5" aria-hidden />
              <span>{storeLabel}</span>
            </p>
            <div className="op-src-probe-actions">
              {pendingCaptures > 0 ? (
                <Tooltip content="Recover stuck mid-run items and drain the remaining pending queue">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={
                      capturing || !config.captureEnabled || !capture?.runnerReady
                    }
                    onClick={() => void runCapture("resume")}
                  >
                    {capturing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    Resume ({pendingCaptures})
                  </Button>
                </Tooltip>
              ) : null}
              <Tooltip content="Queue every source with a URL and capture until the queue is empty">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={capturing || !config.captureEnabled || !capture?.runnerReady}
                  onClick={() => void runCapture("all")}
                >
                  {capturing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FolderArchive className="h-3.5 w-3.5" />
                  )}
                  Capture all
                </Button>
              </Tooltip>
              <Tooltip content="Delete capture queue history and all saved artifact bundles">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-amber"
                  disabled={capturing || clearingCaptures}
                  onClick={() => setConfirmClearCaptures(true)}
                >
                  {clearingCaptures ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Delete all
                </Button>
              </Tooltip>
            </div>
          </div>
        </OperatorSection>
      ) : null}

      <ConfirmDialog
        open={confirmClearCaptures}
        busy={clearingCaptures}
        busyLabel="Deleting…"
        title="Delete all captures?"
        description="Clears the capture queue, removes saved capture bundles, and resets capture status on sources. This cannot be undone."
        confirmLabel="Delete all"
        tone="danger"
        icon={Trash2}
        onCancel={() => setConfirmClearCaptures(false)}
        onConfirm={() => {
          setConfirmClearCaptures(false);
          setClearingCaptures(true);
          void clearCaptures().finally(() => setClearingCaptures(false));
        }}
      />
    </div>
  );
}

export function OperatorSourceProbePanel({
  embedded = false,
  section = "all",
}: {
  embedded?: boolean;
  section?: ProbePanelSection;
}) {
  const existing = useOptionalSourceProbe();
  if (existing) {
    return <ProbePanelBody embedded={embedded} section={section} />;
  }
  return (
    <SourceProbeProvider>
      <ProbePanelBody embedded={embedded} section={section} />
    </SourceProbeProvider>
  );
}

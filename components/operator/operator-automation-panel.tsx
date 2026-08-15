"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eraser,
  Folder,
  Gauge,
  HardDrive,
  Link2,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  Video,
  Workflow,
  Eye,
  FileDown,
  X,
  Zap,
} from "lucide-react";
import { OperatorModule, OperatorSplit } from "@/components/operator/operator-module";
import { Button } from "@/components/ui/button";
import { LazyActivityBars } from "@/components/ui/lazy-charts";
import { toast } from "@/components/ui/toast";
import { BrandLogoLoading } from "@/components/ui/brand-logo-loading";
import { apiFetch, getClientApiKey, invalidateApiCache } from "@/lib/api-client";
import { summarizeParlError, shortUrl } from "@/lib/parliamentary/errors";
import { cn } from "@/lib/utils";
import "@/app/pricing/pricing.css";

type Summary = {
  control: "idle" | "running" | "paused" | "cancelling";
  effectiveControl?: "idle" | "running" | "paused" | "cancelling" | "offline";
  workerLive?: boolean;
  workerAgeMs?: number | null;
  workerPid?: number | null;
  found: number;
  held?: number;
  queued: number;
  downloading: number;
  downloaded?: number;
  transcribing: number;
  done: number;
  failed: number;
  cancelled: number;
  active: number;
  jobs: number;
  seedsEnabled: number;
  seedsTotal: number;
  estimateAsrSec: number;
  batchSize?: number;
  lastError?: string;
};

type Heartbeat = {
  at: string;
  pid: number;
  control: Summary["control"];
  phase: string;
  current?: string;
  message: string;
  counts: {
    found: number;
    held?: number;
    queued: number;
    downloading: number;
    downloaded?: number;
    transcribing: number;
    done: number;
    failed: number;
    cancelled: number;
  };
  queueHead: {
    id: string;
    title: string;
    stage: string;
    country: string;
    progressPct: number;
    eta?: string;
    error?: string;
  }[];
  dryRun: boolean;
};

type JobRow = {
  id: string;
  title: string;
  country: string;
  platform: string;
  stage: string;
  progressPct: number;
  progressLabel?: string;
  bytesDownloaded?: number;
  bytesTotal?: number;
  bytesPerSec?: number;
  retryCount?: number;
  asrProvider?: string;
  model?: string | null;
  transcriptStatus?: string | null;
  hasTranscript?: boolean;
  updatedAt: string;
  error?: string;
  errorDetail?: string;
  mediaUrl?: string;
  folder?: string | null;
  folderAbs?: string | null;
  durationSec?: number;
  estimateAsrSec?: number;
  previewUrl?: string | null;
};

type TranscriptView = {
  jobId: string;
  title: string;
  model?: string;
  asrProvider?: string;
  text: string;
  segmentCount: number;
};

type Seed = {
  id: string;
  url: string;
  label: string;
  country: string;
  enabled: boolean;
  kind: string;
  notes?: string;
};

type LogEvent = {
  id: string;
  at: string;
  level: string;
  message: string;
  meta?: unknown;
  pid?: number;
};

type ServerMeta = {
  dryRun: boolean;
  at: string;
  eventCount: number;
  workerPid: number | null;
  workerAgeMs: number | null;
};

type FlowSettings = {
  batchSize: number;
  maxRetries: number;
  asrProvider: "auto" | "openrouter" | "local";
  updatedAt?: string;
};

const JOBS_PAGE_SIZE = 10;
const SETTINGS_DEBOUNCE_MS = 450;

const LEVEL_ICON = {
  info: Workflow,
  warn: AlertTriangle,
  error: AlertTriangle,
  debug: Bot,
} as const;

const STAGE_COLORS: Record<string, string> = {
  queued: "#5B8CFF",
  downloading: "#22D3EE",
  downloaded: "#2DD4BF",
  transcribing: "#FBBF24",
  done: "#34D399",
  failed: "#F87171",
  held: "#94A3B8",
};

function ageLabel(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return "no heartbeat";
  if (ms < 3000) return "live";
  if (ms < 15_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 120_000) return `${Math.round(ms / 1000)}s stale`;
  return "worker stale";
}

function formatBytes(n?: number | null) {
  if (n == null || !Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(n >= 100 * 1024 ** 2 ? 0 : 1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function formatRate(bps?: number | null) {
  if (bps == null || !Number.isFinite(bps) || bps <= 0) return "—";
  const mbps = bps / 1e6;
  if (mbps >= 10) return `${mbps.toFixed(1)} MB/s`;
  if (mbps >= 0.1) return `${mbps.toFixed(2)} MB/s`;
  return `${(bps / 1024).toFixed(0)} KB/s`;
}

function shortModel(model?: string | null) {
  if (!model) return null;
  const m = model.trim();
  if (!m) return null;
  // openai/whisper-1 → whisper-1; keep local whisper model names as-is
  const slash = m.lastIndexOf("/");
  return slash >= 0 ? m.slice(slash + 1) : m;
}

function ModelBadge({
  provider,
  model,
}: {
  provider?: string | null;
  model?: string | null;
}) {
  const name = shortModel(model);
  if (!provider && !name) {
    return <span className="op-flow-model is-empty">—</span>;
  }
  const src =
    provider === "openrouter" ? "OpenRouter" : provider === "local" ? "Local" : provider || "ASR";
  return (
    <span className="op-flow-model" data-provider={provider || "unknown"} title={model || src}>
      <Bot size={12} aria-hidden />
      <em>{src}</em>
      {name ? <strong>{name}</strong> : null}
    </span>
  );
}

function BandwidthWave({ active, level }: { active: boolean; level: number }) {
  const amp = Math.max(0.12, Math.min(1, level));
  return (
    <svg className="op-flow-wave" viewBox="0 0 120 36" aria-hidden>
      <defs>
        <linearGradient id="opFlowWave" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#5B8CFF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <path
        className={cn("op-flow-wave-path", active && "is-live")}
        d={`M0 22 C 18 ${22 - 14 * amp}, 36 ${22 + 12 * amp}, 54 22 S 90 ${22 - 16 * amp}, 120 22`}
        fill="none"
        stroke="url(#opFlowWave)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d={`M0 28 C 20 ${28 - 8 * amp}, 40 ${28 + 6 * amp}, 60 28 S 100 ${28 - 10 * amp}, 120 28`}
        fill="none"
        stroke="rgba(34,211,238,0.28)"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function MiniThumb({
  previewUrl,
  stage,
}: {
  previewUrl?: string | null;
  stage: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!previewUrl) {
      setSrc(null);
      return;
    }
    let alive = true;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const res = await fetch(previewUrl, { credentials: "include", cache: "force-cache" });
        if (!res.ok) throw new Error("thumb");
        const blob = await res.blob();
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (alive) setSrc(null);
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewUrl]);
  return (
    <div className="op-flow-mini-thumb" data-stage={stage}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" />
      ) : (
        <Video size={14} />
      )}
    </div>
  );
}

function TransferBar({
  pct,
  label,
  rate,
  active,
}: {
  pct: number;
  label?: string;
  rate?: number | null;
  active?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, pct || 0));
  return (
    <div className={cn("op-flow-xfer", active && "is-active")}>
      <div className="op-flow-xfer-track">
        <div className="op-flow-xfer-fill" style={{ width: `${clamped}%` }} />
        <span className="op-flow-xfer-text">
          {label ||
            `${clamped}%${rate && rate > 0 ? ` · ${formatRate(rate)}` : ""}`}
        </span>
      </div>
      <div className="op-flow-xfer-meter" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <i
            key={i}
            style={{
              opacity: active ? Math.max(0.15, Math.min(1, (rate || 0) / 1e6 / 8 + i * 0.05)) : 0.12,
              height: `${30 + ((i * 17) % 50)}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function compactMeta(meta: unknown): string {
  if (meta == null) return "";
  if (typeof meta === "string") return meta;
  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return String(meta);
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  } catch {
    toast.error("Copy failed");
  }
}

function DenseDisclosure({
  headline,
  detail,
  tone = "neutral",
  defaultOpen = false,
  mono = true,
}: {
  headline: string;
  detail: string;
  tone?: "neutral" | "danger" | "warn";
  defaultOpen?: boolean;
  mono?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasDetail = detail.trim().length > 0 && detail.trim() !== headline.trim();
  return (
    <div className={cn("op-flow-dense", `is-${tone}`, open && "is-open")}>
      <div className="op-flow-dense-row">
        <p className="op-flow-dense-head" title={headline}>
          {headline}
        </p>
        <div className="op-flow-dense-actions">
          {hasDetail || detail ? (
            <button
              type="button"
              className="op-flow-dense-btn"
              onClick={() => void copyText(detail || headline)}
              aria-label="Copy full text"
            >
              <Copy size={12} />
            </button>
          ) : null}
          {hasDetail ? (
            <button
              type="button"
              className="op-flow-dense-btn"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
            >
              <ChevronDown size={13} className={cn("op-flow-dense-chev", open && "is-open")} />
              {open ? "Hide" : "Details"}
            </button>
          ) : null}
        </div>
      </div>
      {open && hasDetail ? (
        <pre className={cn("op-flow-dense-body", mono && "is-mono")}>{detail}</pre>
      ) : null}
    </div>
  );
}

function ConsoleLine({ ev }: { ev: LogEvent }) {
  const Icon = LEVEL_ICON[ev.level as keyof typeof LEVEL_ICON] || Workflow;
  const metaText = compactMeta(ev.meta);
  const [open, setOpen] = useState(false);
  const hasMeta = metaText.length > 0;
  return (
    <div className={cn("op-flow-line", `is-${ev.level}`, open && "is-open")}>
      <Icon size={13} className="op-flow-line-ico" aria-hidden />
      <time title={ev.at}>{ev.at.slice(11, 19)}</time>
      <div className="op-flow-line-main">
        <div className="op-flow-line-top">
          {ev.pid ? <span className="op-flow-pid">p{ev.pid}</span> : null}
          <span className="op-flow-lvl">{ev.level}</span>
          <span className="op-flow-line-msg" title={ev.message}>
            {ev.message}
          </span>
          {hasMeta ? (
            <button
              type="button"
              className="op-flow-line-more"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
            >
              {open ? "−" : "+"}
            </button>
          ) : null}
        </div>
        {open && hasMeta ? <pre className="op-flow-line-meta">{metaText}</pre> : null}
      </div>
    </div>
  );
}

function JobError({ error, errorDetail }: { error?: string; errorDetail?: string }) {
  if (!error && !errorDetail) return null;
  const summary = summarizeParlError(errorDetail || error);
  const headline = error && error.length < 160 ? error : summary.headline;
  return (
    <DenseDisclosure
      headline={headline}
      detail={errorDetail || summary.detail || error || ""}
      tone="danger"
    />
  );
}

export function OperatorAutomationPanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [heartbeat, setHeartbeat] = useState<Heartbeat | null>(null);
  const [server, setServer] = useState<ServerMeta | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsTotalPages, setJobsTotalPages] = useState(1);
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [settings, setSettings] = useState<FlowSettings | null>(null);
  const [hardCap, setHardCap] = useState(50);
  const [batchDraft, setBatchDraft] = useState(5);
  const [transcript, setTranscript] = useState<TranscriptView | null>(null);
  const [transcriptBusy, setTranscriptBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [seedUrl, setSeedUrl] = useState("");
  const [seedCountry, setSeedCountry] = useState("BB");
  const [showDebug, setShowDebug] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const settingsTimerRef = useRef<number | null>(null);
  const batchDraftRef = useRef(batchDraft);
  const asrRef = useRef<FlowSettings["asrProvider"]>("auto");

  useEffect(() => {
    batchDraftRef.current = batchDraft;
  }, [batchDraft]);

  const load = useCallback(async (soft = false, page = jobsPage) => {
    if (!soft) setLoading(true);
    try {
      const dashRes = await apiFetch<{
        enabled: boolean;
        dashboard: {
          summary: Summary;
          heartbeat: Heartbeat | null;
          jobs: {
            items: JobRow[];
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
          };
          seeds: Seed[];
          settings: FlowSettings;
          hardCap: number;
          events: LogEvent[];
          server: ServerMeta & { displayOverride?: boolean; reason?: string; healed?: boolean; healReason?: string };
        } | null;
      }>(
        `/api/operator/parliamentary-media/dashboard?page=${page}&pageSize=${JOBS_PAGE_SIZE}`,
        { skipCache: true }
      );

      const dash = dashRes.dashboard;
      if (!dash) {
        setSummary({
          control: "idle",
          effectiveControl: "idle",
          workerLive: false,
          found: 0,
          queued: 0,
          downloading: 0,
          transcribing: 0,
          done: 0,
          failed: 0,
          cancelled: 0,
          active: 0,
          jobs: 0,
          seedsEnabled: 0,
          seedsTotal: 0,
          estimateAsrSec: 0,
        });
        return;
      }

      setSummary(dash.summary);
      setHeartbeat(dash.heartbeat);
      setServer({
        dryRun: dash.server.dryRun,
        at: dash.server.at,
        eventCount: dash.events.length,
        workerPid: dash.summary.workerPid ?? null,
        workerAgeMs: dash.summary.workerAgeMs ?? null,
      });
      setJobs(dash.jobs.items);
      setJobsTotal(dash.jobs.total);
      setJobsTotalPages(dash.jobs.totalPages);
      if (dash.jobs.page !== jobsPage) setJobsPage(dash.jobs.page);
      setSeeds(dash.seeds || []);
      setEvents(dash.events || []);

      const nextCap = Math.max(1, dash.hardCap || 50);
      setHardCap(nextCap);
      setSettings(dash.settings);
      asrRef.current = dash.settings.asrProvider || "auto";
      if (!settingsTimerRef.current) {
        const bs = Math.min(nextCap, Math.max(1, dash.settings.batchSize || 5));
        setBatchDraft(bs);
        batchDraftRef.current = bs;
      }
    } catch (err) {
      if (!soft) toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [jobsPage]);

  useEffect(() => {
    void load(false, jobsPage);
    const id = window.setInterval(() => void load(true, jobsPage), 1500);
    return () => window.clearInterval(id);
  }, [load, jobsPage]);

  useEffect(() => {
    return () => {
      if (settingsTimerRef.current) window.clearTimeout(settingsTimerRef.current);
    };
  }, []);

  function goJobsPage(next: number) {
    const clamped = Math.min(Math.max(1, next), jobsTotalPages);
    if (clamped === jobsPage) return;
    setJobsPage(clamped);
  }

  async function persistSettings(patch: Partial<Pick<FlowSettings, "batchSize" | "asrProvider">>) {
    setSettingsSaving(true);
    try {
      const res = await apiFetch<{ settings: FlowSettings; hardCap: number }>(
        "/api/operator/parliamentary-media/settings",
        {
          method: "POST",
          body: JSON.stringify(patch),
        }
      );
      setSettings(res.settings);
      setHardCap(Math.max(1, res.hardCap || 50));
      asrRef.current = res.settings.asrProvider;
      if (patch.batchSize != null) {
        setBatchDraft(res.settings.batchSize);
        batchDraftRef.current = res.settings.batchSize;
      }
      invalidateApiCache("/api/operator/parliamentary-media");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Settings save failed");
    } finally {
      setSettingsSaving(false);
      settingsTimerRef.current = null;
    }
  }

  function scheduleBatchSave(next: number) {
    setBatchDraft(next);
    batchDraftRef.current = next;
    if (settingsTimerRef.current) window.clearTimeout(settingsTimerRef.current);
    settingsTimerRef.current = window.setTimeout(() => {
      void persistSettings({ batchSize: batchDraftRef.current });
    }, SETTINGS_DEBOUNCE_MS);
  }

  async function control(action: "start" | "pause" | "cancel") {
    setBusy(action);
    try {
      if (action === "start") {
        setSummary((prev) =>
          prev
            ? {
                ...prev,
                control: "running",
                effectiveControl: "running",
                workerLive: true,
                lastError: undefined,
              }
            : prev
        );
      } else if (action === "pause") {
        setSummary((prev) =>
          prev
            ? { ...prev, control: "paused", effectiveControl: "paused" }
            : prev
        );
      } else if (action === "cancel") {
        setSummary((prev) =>
          prev
            ? {
                ...prev,
                control: "cancelling",
                effectiveControl: "cancelling",
                downloading: 0,
                transcribing: 0,
                active: 0,
              }
            : prev
        );
      }
      await apiFetch("/api/operator/parliamentary-media/control", {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      invalidateApiCache("/api/operator/parliamentary-media");
      await load(true, action === "start" || action === "cancel" ? 1 : jobsPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Control failed");
      await load(true);
    } finally {
      setBusy(null);
    }
  }

  async function clearAll() {
    const ok = window.confirm(
      "Clear Automation completely?\n\nThis will:\n• Kill the media worker and child processes\n• Delete all downloaded videos and thumbnails\n• Empty the queue, candidates, logs, and dashboard counters\n• Restart an idle worker (verified sources kept)\n\nThis cannot be undone."
    );
    if (!ok) return;
    setBusy("clear");
    try {
      await apiFetch("/api/operator/parliamentary-media/control", {
        method: "POST",
        body: JSON.stringify({ action: "clear", confirm: true }),
      });
      invalidateApiCache("/api/operator/parliamentary-media");
      setJobs([]);
      setJobsTotal(0);
      setJobsPage(1);
      setJobsTotalPages(1);
      setEvents([]);
      setHeartbeat(null);
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              control: "idle",
              found: 0,
              held: 0,
              queued: 0,
              downloading: 0,
              downloaded: 0,
              transcribing: 0,
              done: 0,
              failed: 0,
              cancelled: 0,
              active: 0,
              jobs: 0,
              lastError: undefined,
            }
          : prev
      );
      toast.success("Automation cleared");
      await load(true, 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setBusy(null);
    }
  }

  async function addSeed() {
    if (!seedUrl.trim()) return;
    setBusy("seed");
    try {
      await apiFetch("/api/operator/parliamentary-media/seeds", {
        method: "POST",
        body: JSON.stringify({
          url: seedUrl.trim(),
          country: seedCountry,
          enabled: true,
          kind: /vimeo\.com/i.test(seedUrl) ? "vimeo_showcase" : "site_pages",
        }),
      });
      setSeedUrl("");
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add source");
    } finally {
      setBusy(null);
    }
  }

  async function resetSources() {
    setBusy("reset");
    try {
      await apiFetch("/api/operator/parliamentary-media/seeds", {
        method: "POST",
        body: JSON.stringify({ action: "reset_verified" }),
      });
      toast.success("Sources reset to verified BB/GY set");
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(null);
    }
  }

  async function toggleSeed(seed: Seed) {
    setBusy(seed.id);
    try {
      await apiFetch("/api/operator/parliamentary-media/seeds", {
        method: "POST",
        body: JSON.stringify({ ...seed, enabled: !seed.enabled }),
      });
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function deleteSeed(id: string) {
    setBusy(id);
    try {
      await apiFetch(`/api/operator/parliamentary-media/seeds?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(null);
    }
  }

  async function showTranscript(job: JobRow) {
    setTranscriptBusy(job.id);
    try {
      const res = await apiFetch<{ transcript: TranscriptView }>(
        `/api/operator/parliamentary-media/transcript?id=${encodeURIComponent(job.id)}`,
        { skipCache: true }
      );
      setTranscript(res.transcript);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transcript unavailable");
    } finally {
      setTranscriptBusy(null);
    }
  }

  async function downloadTranscript(jobId: string, format: "txt" | "csv" = "txt") {
    setTranscriptBusy(`dl:${jobId}:${format}`);
    try {
      const url = `/api/operator/parliamentary-media/transcript?id=${encodeURIComponent(jobId)}&download=1&format=${format}`;
      const res = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${getClientApiKey()}`,
        },
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="([^"]+)"/i);
      const filename = match?.[1] || `transcript.${format}`;
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setTranscriptBusy(null);
    }
  }

  if (loading && !summary && !jobs.length) {
    return (
      <div className="op-flow">
        <BrandLogoLoading label="Loading automation…" />
      </div>
    );
  }

  const s = summary;
  const displayControl = s?.effectiveControl || s?.control || "idle";
  const running = displayControl === "running";
  const paused = displayControl === "paused";
  const offline = displayControl === "offline";
  const dryRun = server?.dryRun || heartbeat?.dryRun;
  const workerAge = s?.workerAgeMs ?? server?.workerAgeMs ?? null;
  const workerLive = Boolean(s?.workerLive);
  const visibleEvents = showDebug ? events : events.filter((e) => e.level !== "debug");
  const held = s?.held ?? 0;
  const found = s?.found ?? 0;
  const batchN = batchDraft;
  const liveBps = jobs
    .filter((j) => j.stage === "downloading")
    .reduce((sum, j) => sum + (j.bytesPerSec || 0), 0);
  const transferred = jobs.reduce((sum, j) => sum + (j.bytesDownloaded || 0), 0);
  const peakSample = Math.max(0, ...jobs.map((j) => j.bytesPerSec || 0));
  const waveLevel = liveBps > 0 ? Math.min(1, liveBps / 8e6) : peakSample > 0 ? 0.35 : 0.12;
  const stageBars = [
    { key: "queued", value: s?.queued ?? 0 },
    { key: "downloading", value: s?.downloading ?? 0 },
    { key: "downloaded", value: s?.downloaded ?? 0 },
    { key: "transcribing", value: s?.transcribing ?? 0 },
    { key: "done", value: s?.done ?? 0 },
    { key: "failed", value: s?.failed ?? 0 },
    { key: "held", value: held },
  ].map((row) => ({
    label: row.key,
    value: row.value,
    color: STAGE_COLORS[row.key],
    detail: `${row.value} ${row.key}`,
  }));

  const kpis: { label: string; value: string | number; icon: typeof Download; tone?: string }[] = [
    { label: "Found", value: found, icon: Archive },
    { label: "Held", value: held, icon: Pause },
    { label: "Queued", value: s?.queued ?? 0, icon: Workflow },
    { label: "DL", value: s?.downloading ?? 0, icon: Download, tone: "cyan" },
    { label: "Ready", value: s?.downloaded ?? 0, icon: HardDrive },
    { label: "ASR", value: s?.transcribing ?? 0, icon: Activity, tone: "amber" },
    { label: "Done", value: s?.done ?? 0, icon: CheckCircle2, tone: "green" },
    { label: "Failed", value: s?.failed ?? 0, icon: AlertTriangle, tone: "red" },
  ];
  const batchPct = hardCap > 1 ? ((Math.min(hardCap, Math.max(1, batchN)) - 1) / (hardCap - 1)) * 100 : 0;

  return (
    <div className="op-flow">
      <header className="op-flow-head">
        <div className="op-flow-title">
          <span className="op-flow-mark">
            <Bot size={18} />
          </span>
          <div>
            <h2>Automation</h2>
            <p className="op-flow-sub">
              Batch {batchN} · {s?.seedsEnabled ?? 0} sources
              {dryRun ? " · dry-run" : ""}
              {settingsSaving ? " · saving…" : ""}
            </p>
          </div>
        </div>
        <div className="op-flow-controls">
          <Button
            type="button"
            size="sm"
            className="op-flow-btn"
            onClick={() => void control("start")}
            disabled={!!busy || running || offline}
            title={offline ? "Worker offline — restart parl-media worker to resume" : undefined}
          >
            <Play size={14} /> Start
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="op-flow-btn"
            onClick={() => void control("pause")}
            disabled={!!busy || (!running && !paused && !offline)}
          >
            <Pause size={14} /> Pause
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            className="op-flow-btn"
            onClick={() => void control("cancel")}
            disabled={!!busy || displayControl === "idle"}
          >
            <Square size={14} /> Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            className="op-flow-btn op-flow-clear-btn"
            onClick={() => void clearAll()}
            disabled={!!busy}
            title="Kill worker, wipe videos/queue/logs, restart idle"
          >
            {busy === "clear" ? <Loader2 size={14} className="op-flow-spin" /> : <Eraser size={14} />}
            Clear
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="op-flow-btn"
            onClick={() => void load()}
            disabled={!!busy}
          >
            <RefreshCw size={14} />
          </Button>
          <span className="op-flow-state" data-state={displayControl}>
            {displayControl}
          </span>
        </div>
      </header>

      <div
        className={cn(
          "op-flow-pulse",
          workerLive && workerAge != null && workerAge < 15_000 ? "is-live" : "is-stale"
        )}
      >
        <span data-k="phase">{workerLive ? heartbeat?.phase || "—" : "offline"}</span>
        <span data-k="msg" title={heartbeat?.message}>
          {offline
            ? "Worker offline — badge will not show running. Restart worker to resume, or Cancel to idle."
            : heartbeat?.message || "Waiting for worker heartbeat…"}
        </span>
        <span data-k="worker">
          pid {s?.workerPid ?? server?.workerPid ?? "—"} · {ageLabel(workerAge)}
          {dryRun ? " · DRY-RUN" : ""}
          {!workerLive ? " · OFFLINE" : ""}
        </span>
        {heartbeat?.current ? (
          <span data-k="cur" title={heartbeat.current}>
            {heartbeat.current}
          </span>
        ) : null}
      </div>

      {s?.lastError ? (
        <DenseDisclosure
          headline={summarizeParlError(s.lastError).headline}
          detail={s.lastError}
          tone="danger"
        />
      ) : null}
      {dryRun ? (
        <p className="op-flow-banner">
          Dry-run is on — catalogue only. Set PARL_MEDIA_DRY_RUN=0 and redeploy worker.
        </p>
      ) : null}

      <div className="op-flow-batch">
        <div className="op-flow-batch-main">
          <div className="op-flow-slider">
            <div className="op-flow-slider-rail" style={{ ["--op-batch" as string]: `${batchPct}%` }}>
              <span className="op-flow-slider-fill" />
              <span className="op-flow-slider-chip" style={{ left: `calc(${batchPct}% - 1.1rem)` }}>
                {batchN}
              </span>
              <input
                id="op-flow-batch-range"
                type="range"
                className="op-flow-range"
                min={1}
                max={hardCap}
                step={1}
                value={Math.min(hardCap, Math.max(1, batchN))}
                disabled={!!busy}
                onChange={(e) => scheduleBatchSave(Number(e.target.value))}
                aria-label={`Process ${batchN} of retrieved`}
              />
            </div>
            <div className="op-flow-slider-caption">
              <Gauge size={15} />
              <span>
                Process <strong>{batchN}</strong>
                {found ? ` / ${found}` : ""} · rest held
                {held ? ` (${held})` : ""}
              </span>
              <em>1–{hardCap}</em>
            </div>
          </div>
        </div>
        <label className="op-flow-asr">
          <span>ASR</span>
          <select
            className="op-flow-select"
            value={settings?.asrProvider || "auto"}
            disabled={!!busy || settingsSaving}
            onChange={(e) => {
              const next = e.target.value as FlowSettings["asrProvider"];
              asrRef.current = next;
              setSettings((prev) => (prev ? { ...prev, asrProvider: next } : prev));
              void persistSettings({ asrProvider: next });
            }}
          >
            <option value="auto">auto</option>
            <option value="openrouter">openrouter</option>
            <option value="local">local</option>
          </select>
        </label>
      </div>

      <div className="op-flow-stats-row">
        <div className={cn("op-flow-bw", liveBps > 0 && "is-live")}>
          <div className="op-flow-bw-copy">
            <span>
              <Zap size={15} /> Live bandwidth
            </span>
            <strong>{formatRate(liveBps)}</strong>
            <em>
              peak {formatRate(peakSample)} · moved {formatBytes(transferred)}
            </em>
          </div>
          <BandwidthWave active={liveBps > 0} level={waveLevel} />
        </div>
        <div className="op-flow-kpis">
          {kpis.map((k) => (
            <article key={k.label} className={cn("op-flow-kpi", k.tone && `tone-${k.tone}`)}>
              <k.icon size={14} aria-hidden />
              <span>{k.label}</span>
              <strong>{k.value}</strong>
            </article>
          ))}
        </div>
      </div>

      <OperatorModule title="Stages" hint="Pipeline counts" className="op-flow-chart-mod">
        <div className="op-flow-chart">
          <LazyActivityBars
            items={
              stageBars.some((b) => b.value > 0)
                ? stageBars
                : [{ label: "idle", value: 0, color: "#94A3B8", detail: "0 idle" }]
            }
            heightClass="h-[8.5rem]"
            color="#5B8CFF"
            valueLabel="jobs"
          />
        </div>
      </OperatorModule>

      <OperatorSplit
        className="op-flow-split"
        left={
          <OperatorModule
            title="Sources"
            actions={
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="op-flow-btn"
                disabled={!!busy}
                onClick={() => void resetSources()}
              >
                <Link2 size={13} /> Reset verified
              </Button>
            }
            className="op-flow-mod"
            bodyClassName="op-flow-mod-body"
          >
            <div className="op-flow-seed-form">
              <input
                className="op-flow-input"
                placeholder="https://vimeo.com/barbadosparliament/videos"
                value={seedUrl}
                onChange={(e) => setSeedUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void addSeed()}
              />
              <select
                className="op-flow-select"
                value={seedCountry}
                onChange={(e) => setSeedCountry(e.target.value)}
              >
                {["BB", "GY"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                className="op-flow-btn"
                onClick={() => void addSeed()}
                disabled={!!busy || !seedUrl.trim()}
              >
                <Plus size={14} /> Add
              </Button>
            </div>
            <ul className="op-flow-seed-list">
              {seeds.map((seed) => (
                <li key={seed.id} className={cn("op-flow-seed", !seed.enabled && "is-off")}>
                  <button
                    type="button"
                    className="op-flow-seed-toggle"
                    onClick={() => void toggleSeed(seed)}
                    disabled={!!busy}
                  >
                    <span data-on={seed.enabled} />
                  </button>
                  <div className="op-flow-seed-main">
                    <strong title={seed.label}>{seed.label}</strong>
                    <a href={seed.url} target="_blank" rel="noreferrer" title={seed.url}>
                      {shortUrl(seed.url, 48)}
                    </a>
                    <em>
                      {seed.country} · {seed.kind}
                      {seed.notes ? ` · ${seed.notes}` : ""}
                    </em>
                  </div>
                  <button
                    type="button"
                    className="op-flow-icon-btn"
                    onClick={() => void deleteSeed(seed.id)}
                    disabled={!!busy}
                    aria-label="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </OperatorModule>
        }
        right={
          <OperatorModule
            title="Console"
            actions={
              <div className="op-flow-card-actions">
                <span>{visibleEvents.length} lines</span>
                <button
                  type="button"
                  className="op-flow-debug-toggle"
                  onClick={() => setShowDebug((v) => !v)}
                >
                  {showDebug ? "Hide debug" : "Show debug"}
                </button>
              </div>
            }
            className="op-flow-mod op-flow-console-mod"
            bodyClassName="op-flow-mod-body"
          >
            <div className="op-flow-console">
              {!visibleEvents.length ? (
                <p className="op-flow-console-empty">Waiting for worker events…</p>
              ) : (
                visibleEvents.map((ev) => <ConsoleLine key={ev.id} ev={ev} />)
              )}
            </div>
          </OperatorModule>
        }
      />

      <OperatorModule
        title="Queue"
        actions={
          <span className="op-flow-queue-count">
            {jobsTotal
              ? `${(jobsPage - 1) * JOBS_PAGE_SIZE + 1}–${Math.min(jobsPage * JOBS_PAGE_SIZE, jobsTotal)} / ${jobsTotal}`
              : `${s?.jobs ?? 0}`}
          </span>
        }
        className="op-flow-mod op-flow-queue-mod"
        bodyClassName="op-flow-mod-body is-table"
      >
        {!jobs.length ? (
          <p className="op-flow-empty">No jobs yet — Start to catalogue sittings.</p>
        ) : (
          <>
            <div className="op-flow-table-wrap">
              <table className="op-flow-table op-flow-table-saas">
                <tbody>
                  {jobs.map((j) => {
                    const active = j.stage === "downloading" || j.stage === "transcribing";
                    const ready = Boolean(j.hasTranscript || j.stage === "done");
                    const xferLabel =
                      j.stage === "downloading"
                        ? [
                            j.bytesTotal
                              ? `${formatBytes(j.bytesDownloaded)} / ${formatBytes(j.bytesTotal)}`
                              : formatBytes(j.bytesDownloaded),
                            j.bytesPerSec ? formatRate(j.bytesPerSec) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : j.progressLabel || undefined;
                    return (
                      <tr key={j.id} className={cn(`is-${j.stage}`, active && "is-active")}>
                        <td className="op-flow-td-thumb">
                          <MiniThumb previewUrl={j.previewUrl} stage={j.stage} />
                        </td>
                        <td className="op-flow-td-title">
                          <strong title={j.title}>{j.title}</strong>
                          <div className="op-flow-title-meta">
                            <span>{j.country}</span>
                            {j.durationSec ? (
                              <span>{Math.round(j.durationSec / 60)}m</span>
                            ) : null}
                          </div>
                          {j.mediaUrl ? (
                            <div className="op-flow-path-row">
                              <Link2 size={12} aria-hidden />
                              <a
                                href={j.mediaUrl}
                                target="_blank"
                                rel="noreferrer"
                                title={j.mediaUrl}
                              >
                                {shortUrl(j.mediaUrl, 48)}
                              </a>
                              <button
                                type="button"
                                className="op-flow-copy"
                                title="Copy video link"
                                onClick={() => void copyText(j.mediaUrl!)}
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          ) : null}
                          {j.folderAbs || j.folder ? (
                            <div className="op-flow-path-row is-folder">
                              <Folder size={12} aria-hidden />
                              <span title={j.folderAbs || j.folder || undefined}>
                                {j.folderAbs || j.folder}
                              </span>
                              <button
                                type="button"
                                className="op-flow-copy"
                                title="Copy folder path"
                                onClick={() => void copyText(j.folderAbs || j.folder || "")}
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          ) : null}
                          <JobError error={j.error} errorDetail={j.errorDetail} />
                        </td>
                        <td className="op-flow-td-stage">
                          <span className="op-flow-stage" data-stage={j.stage}>
                            {active ? <Loader2 size={12} className="op-flow-spin" /> : null}
                            {j.stage === "done" ? <CheckCircle2 size={12} /> : null}
                            {j.stage === "failed" ? <AlertTriangle size={12} /> : null}
                            {j.stage}
                          </span>
                        </td>
                        <td className="op-flow-td-xfer">
                          <TransferBar
                            pct={j.progressPct || 0}
                            label={xferLabel}
                            rate={j.stage === "downloading" ? j.bytesPerSec : null}
                            active={active}
                          />
                        </td>
                        <td className="op-flow-td-model">
                          {j.stage === "done" || j.model || j.asrProvider ? (
                            <ModelBadge provider={j.asrProvider} model={j.model} />
                          ) : (
                            <span className="op-flow-model is-empty">—</span>
                          )}
                        </td>
                        <td className="op-flow-td-actions">
                          <button
                            type="button"
                            className="op-flow-act"
                            disabled={!ready || transcriptBusy === j.id}
                            onClick={() => void showTranscript(j)}
                            title="View transcript"
                          >
                            {transcriptBusy === j.id ? (
                              <Loader2 size={14} className="op-flow-spin" />
                            ) : (
                              <Eye size={14} />
                            )}
                            View
                          </button>
                          <button
                            type="button"
                            className="op-flow-act"
                            disabled={!ready}
                            onClick={() => void downloadTranscript(j.id, "txt")}
                            title="Download transcript"
                          >
                            <FileDown size={14} />
                            Download
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <nav className="op-flow-pager" aria-label="Queue pages">
              <span>
                {jobsPage}/{jobsTotalPages}
              </span>
              <div className="op-flow-pager-controls">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="op-flow-btn"
                  disabled={jobsPage <= 1 || !!busy}
                  onClick={() => goJobsPage(jobsPage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="op-flow-btn"
                  disabled={jobsPage >= jobsTotalPages || !!busy}
                  onClick={() => goJobsPage(jobsPage + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            </nav>
          </>
        )}
      </OperatorModule>

      {transcript ? (
        <div className="op-flow-sheet" role="dialog" aria-modal="true" aria-label="Transcript">
          <button
            type="button"
            className="op-flow-sheet-backdrop"
            aria-label="Close"
            onClick={() => setTranscript(null)}
          />
          <div className="op-flow-sheet-panel">
            <header className="op-flow-sheet-head">
              <div>
                <h3>{transcript.title}</h3>
                <ModelBadge provider={transcript.asrProvider} model={transcript.model} />
              </div>
              <div className="op-flow-sheet-actions">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="op-flow-btn"
                  onClick={() => void downloadTranscript(transcript.jobId, "txt")}
                >
                  <FileDown size={14} /> TXT
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="op-flow-btn"
                  onClick={() => void downloadTranscript(transcript.jobId, "csv")}
                >
                  <FileDown size={14} /> CSV
                </Button>
                <button
                  type="button"
                  className="op-flow-icon-btn"
                  onClick={() => setTranscript(null)}
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </header>
            <p className="op-flow-sheet-note">Machine transcript · not official Hansard</p>
            <pre className="op-flow-sheet-body">
              {transcript.text || "No transcript text available."}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

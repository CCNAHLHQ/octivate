"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eraser,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { BrandLogoLoading } from "@/components/ui/brand-logo-loading";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import { summarizeParlError, shortUrl } from "@/lib/parliamentary/errors";
import { cn } from "@/lib/utils";
import "@/app/pricing/pricing.css";

type Summary = {
  control: "idle" | "running" | "paused" | "cancelling";
  found: number;
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
  updatedAt: string;
  error?: string;
  errorDetail?: string;
  mediaUrl?: string;
  durationSec?: number;
  estimateAsrSec?: number;
  previewUrl?: string | null;
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

function eta(sec?: number) {
  if (!sec || sec <= 0) return "—";
  if (sec < 60) return `${Math.round(sec)}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`;
}

function relativeTime(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(mins)) return "—";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function ageLabel(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return "no heartbeat";
  if (ms < 3000) return "live";
  if (ms < 15_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 120_000) return `${Math.round(ms / 1000)}s stale`;
  return "worker stale";
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

/** Collapsed-by-default block for stack traces / JSON / long diagnostics. */
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
    <div className={cn("op-auto-dense", `is-${tone}`, open && "is-open")}>
      <div className="op-auto-dense-row">
        <p className="op-auto-dense-head" title={headline}>
          {headline}
        </p>
        <div className="op-auto-dense-actions">
          {hasDetail || detail ? (
            <button
              type="button"
              className="op-auto-dense-btn"
              onClick={() => void copyText(detail || headline)}
              aria-label="Copy full text"
            >
              <Copy size={12} />
            </button>
          ) : null}
          {hasDetail ? (
            <button
              type="button"
              className="op-auto-dense-btn"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
            >
              <ChevronDown size={13} className={cn("op-auto-dense-chev", open && "is-open")} />
              {open ? "Hide" : "Details"}
            </button>
          ) : null}
        </div>
      </div>
      {open && hasDetail ? (
        <pre className={cn("op-auto-dense-body", mono && "is-mono")}>{detail}</pre>
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
    <div className={cn("op-auto-line", `is-${ev.level}`, open && "is-open")}>
      <Icon size={13} className="op-auto-line-ico" aria-hidden />
      <time title={ev.at}>{ev.at.slice(11, 19)}</time>
      <div className="op-auto-line-main">
        <div className="op-auto-line-top">
          {ev.pid ? <span className="op-auto-pid">p{ev.pid}</span> : null}
          <span className="op-auto-lvl">{ev.level}</span>
          <span className="op-auto-line-msg" title={ev.message}>
            {ev.message}
          </span>
          {hasMeta ? (
            <button
              type="button"
              className="op-auto-line-more"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
            >
              {open ? "−" : "+"}
            </button>
          ) : null}
        </div>
        {open && hasMeta ? <pre className="op-auto-line-meta">{metaText}</pre> : null}
      </div>
    </div>
  );
}

const LEVEL_ICON = {
  info: Workflow,
  warn: AlertTriangle,
  error: AlertTriangle,
  debug: Bot,
} as const;

const JOBS_PAGE_SIZE = 5;

function JobThumb({
  previewUrl,
  platform,
  title,
  stage,
}: {
  previewUrl?: string | null;
  platform: string;
  title: string;
  stage: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!previewUrl) {
      setSrc(null);
      setBroken(false);
      return;
    }
    let alive = true;
    let objectUrl: string | null = null;
    setBroken(false);
    setSrc(null);
    void (async () => {
      try {
        const res = await fetch(previewUrl, { credentials: "include", cache: "force-cache" });
        if (!res.ok) throw new Error(`thumb_${res.status}`);
        const blob = await res.blob();
        if (!alive) return;
        if (!blob.type.startsWith("image/") && blob.size < 200) throw new Error("not_image");
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (alive) setBroken(true);
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewUrl]);

  const showImg = !!src && !broken;
  return (
    <div className="op-auto-preview" data-stage={stage}>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
      ) : (
        <div className="op-auto-preview-fallback">
          <Video size={22} />
          <span>{platform || "media"}</span>
        </div>
      )}
      <span className="op-auto-stage-pill" title={title}>
        {stage === "done" ? <CheckCircle2 size={12} /> : null}
        {stage === "downloading" || stage === "transcribing" ? (
          <Loader2 size={12} className="op-auto-spin" />
        ) : null}
        {stage === "queued" || stage === "downloaded" ? <Download size={12} /> : null}
        {stage === "failed" || stage === "cancelled" ? <AlertTriangle size={12} /> : null}
        {stage}
      </span>
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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [seedUrl, setSeedUrl] = useState("");
  const [seedCountry, setSeedCountry] = useState("BB");
  const [showDebug, setShowDebug] = useState(false);

  const load = useCallback(async (soft = false, page = jobsPage) => {
    if (!soft) setLoading(true);
    try {
      const live = { skipCache: true as const };
      const [sumRes, jobsRes, seedsRes, evRes] = await Promise.all([
        apiFetch<{ summary: Summary }>("/api/operator/parliamentary-media/summary", live),
        apiFetch<{
          items: JobRow[];
          page: number;
          pageSize: number;
          total: number;
          totalPages: number;
        }>(
          `/api/operator/parliamentary-media/jobs?page=${page}&pageSize=${JOBS_PAGE_SIZE}`,
          live
        ),
        apiFetch<{ seeds: Seed[] }>("/api/operator/parliamentary-media/seeds", live),
        apiFetch<{
          events: LogEvent[];
          summary: Summary;
          heartbeat: Heartbeat | null;
          server: ServerMeta;
          queue?: JobRow[];
        }>("/api/operator/parliamentary-media/events?limit=80", live),
      ]);

      const hb = evRes.heartbeat;
      const base = evRes.summary || sumRes.summary;
      const fresh =
        hb &&
        typeof evRes.server?.workerAgeMs === "number" &&
        evRes.server.workerAgeMs < 20_000;
      const merged: Summary = fresh
        ? {
            ...base,
            control: hb.control || base.control,
            found: hb.counts.found ?? base.found,
            queued: hb.counts.queued ?? base.queued,
            downloading: hb.counts.downloading ?? base.downloading,
            downloaded: hb.counts.downloaded ?? base.downloaded ?? 0,
            transcribing: hb.counts.transcribing ?? base.transcribing,
            done: hb.counts.done ?? base.done,
            failed: hb.counts.failed ?? base.failed,
            cancelled: hb.counts.cancelled ?? base.cancelled,
            active:
              (hb.counts.downloading || 0) +
              (hb.counts.downloaded || 0) +
              (hb.counts.transcribing || 0),
          }
        : base;

      const totalPages = Math.max(1, jobsRes.totalPages || 1);
      const nextPage = Math.min(Math.max(1, jobsRes.page || page), totalPages);
      setSummary(merged);
      setHeartbeat(hb || null);
      setServer(evRes.server || null);
      setJobs(jobsRes.items || []);
      setJobsTotal(jobsRes.total || 0);
      setJobsTotalPages(totalPages);
      if (nextPage !== jobsPage) setJobsPage(nextPage);
      setSeeds(seedsRes.seeds || []);
      setEvents(evRes.events || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [jobsPage]);

  useEffect(() => {
    void load(false, jobsPage);
    const id = window.setInterval(() => void load(true, jobsPage), 1500);
    return () => window.clearInterval(id);
  }, [load, jobsPage]);

  function goJobsPage(next: number) {
    const clamped = Math.min(Math.max(1, next), jobsTotalPages);
    if (clamped === jobsPage) return;
    setJobsPage(clamped);
  }

  async function control(action: "start" | "pause" | "cancel") {
    setBusy(action);
    try {
      await apiFetch("/api/operator/parliamentary-media/control", {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      invalidateApiCache("/api/operator/parliamentary-media");
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Control failed");
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

  if (loading && !summary) {
    return (
      <div className="op-auto">
        <BrandLogoLoading label="Loading automation…" />
      </div>
    );
  }

  const s = summary;
  const running = s?.control === "running";
  const paused = s?.control === "paused";
  const dryRun = server?.dryRun || heartbeat?.dryRun;
  const workerAge = server?.workerAgeMs ?? null;
  const visibleEvents = showDebug
    ? events
    : events.filter((e) => e.level !== "debug");

  return (
    <div className="op-auto">
      <header className="op-auto-head">
        <div className="op-auto-title">
          <span className="op-auto-mark">
            <Bot size={18} />
          </span>
          <div>
            <h2>Automation</h2>
            <p className="op-auto-sub">
              ASR queue ETA {eta(s?.estimateAsrSec)} · {s?.seedsEnabled ?? 0} sources
              {dryRun ? " · dry-run" : ""}
            </p>
          </div>
        </div>
        <div className="op-auto-controls">
          <Button type="button" size="sm" className="op-auto-btn" onClick={() => void control("start")} disabled={!!busy || running}>
            <Play size={14} /> Start
          </Button>
          <Button type="button" size="sm" variant="ghost" className="op-auto-btn" onClick={() => void control("pause")} disabled={!!busy || (!running && !paused)}>
            <Pause size={14} /> Pause
          </Button>
          <Button type="button" size="sm" variant="danger" className="op-auto-btn" onClick={() => void control("cancel")} disabled={!!busy || s?.control === "idle"}>
            <Square size={14} /> Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            className="op-auto-btn op-auto-clear-btn"
            onClick={() => void clearAll()}
            disabled={!!busy}
            title="Kill worker, wipe videos/queue/logs, restart idle"
          >
            {busy === "clear" ? <Loader2 size={14} className="op-auto-spin" /> : <Eraser size={14} />}
            Clear
          </Button>
          <Button type="button" size="sm" variant="ghost" className="op-auto-btn" onClick={() => void load()} disabled={!!busy}>
            <RefreshCw size={14} />
          </Button>
          <span className="op-auto-state" data-state={s?.control || "idle"}>
            {s?.control || "idle"}
          </span>
        </div>
      </header>

      <div
        className={cn(
          "op-auto-pulse",
          workerAge != null && workerAge < 15_000 ? "is-live" : "is-stale"
        )}
      >
        <span data-k="phase">{heartbeat?.phase || "—"}</span>
        <span data-k="msg" title={heartbeat?.message}>
          {heartbeat?.message || "Waiting for worker heartbeat…"}
        </span>
        <span data-k="worker">
          pid {server?.workerPid ?? "—"} · {ageLabel(workerAge)}
          {dryRun ? " · DRY-RUN" : ""}
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
        <p className="op-auto-banner">
          Dry-run is on — catalogue only. Set PARL_MEDIA_DRY_RUN=0 and redeploy worker.
        </p>
      ) : null}

      <div className="op-auto-kpis">
        {[
          ["Found", s?.found ?? 0],
          ["Queued", s?.queued ?? 0],
          ["DL", s?.downloading ?? 0],
          ["Ready", s?.downloaded ?? 0],
          ["ASR", s?.transcribing ?? 0],
          ["Done", s?.done ?? 0],
          ["Failed", s?.failed ?? 0],
          ["ASR ETA", eta(s?.estimateAsrSec)],
        ].map(([label, value]) => (
          <article key={label} className="op-auto-kpi">
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      {heartbeat?.queueHead?.length ? (
        <ul className="op-auto-queue-head">
          {heartbeat.queueHead.slice(0, 6).map((q) => (
            <li key={q.id}>
              <em>{q.stage}</em>
              <strong title={q.title}>{q.title}</strong>
              <span>
                {q.country}
                {q.eta ? ` · ${q.eta}` : ""}
                {q.progressPct ? ` · ${q.progressPct}%` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="op-auto-grid">
        <section className="op-auto-card">
          <header className="op-auto-card-head">
            <h3><Link2 size={15} /> Sources</h3>
            <div className="op-auto-card-actions">
              <span>BB Vimeo + GY sittings</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="op-auto-btn"
                disabled={!!busy}
                onClick={() => void resetSources()}
              >
                Reset verified
              </Button>
            </div>
          </header>
          <div className="op-auto-seed-form">
            <input
              className="op-auto-input"
              placeholder="https://vimeo.com/barbadosparliament/videos"
              value={seedUrl}
              onChange={(e) => setSeedUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addSeed()}
            />
            <select className="op-auto-select" value={seedCountry} onChange={(e) => setSeedCountry(e.target.value)}>
              {["BB", "GY"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <Button type="button" size="sm" className="op-auto-btn" onClick={() => void addSeed()} disabled={!!busy || !seedUrl.trim()}>
              <Plus size={14} /> Add
            </Button>
          </div>
          <ul className="op-auto-seed-list">
            {seeds.map((seed) => (
              <li key={seed.id} className={cn("op-auto-seed", !seed.enabled && "is-off")}>
                <button type="button" className="op-auto-seed-toggle" onClick={() => void toggleSeed(seed)} disabled={!!busy}>
                  <span data-on={seed.enabled} />
                </button>
                <div className="op-auto-seed-main">
                  <strong title={seed.label}>{seed.label}</strong>
                  <a href={seed.url} target="_blank" rel="noreferrer" title={seed.url}>
                    {shortUrl(seed.url, 48)}
                  </a>
                  <em>{seed.country} · {seed.kind}{seed.notes ? ` · ${seed.notes}` : ""}</em>
                </div>
                <button type="button" className="op-auto-icon-btn" onClick={() => void deleteSeed(seed.id)} disabled={!!busy} aria-label="Remove">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="op-auto-card op-auto-console-card">
          <header className="op-auto-card-head">
            <h3>Live console</h3>
            <div className="op-auto-card-actions">
              <span>{visibleEvents.length} lines</span>
              <button
                type="button"
                className="op-auto-debug-toggle"
                onClick={() => setShowDebug((v) => !v)}
              >
                {showDebug ? "Hide debug" : "Show debug"}
              </button>
            </div>
          </header>
          <div className="op-auto-console">
            {!visibleEvents.length ? (
              <p className="op-auto-console-empty">
                Waiting for worker events…
              </p>
            ) : (
              visibleEvents.map((ev) => <ConsoleLine key={ev.id} ev={ev} />)
            )}
          </div>
        </section>
      </div>

      <section className="op-auto-card op-auto-queue-card">
        <header className="op-auto-card-head">
          <h3><Video size={15} /> Queue</h3>
          <span>
            {jobsTotal
              ? `${(jobsPage - 1) * JOBS_PAGE_SIZE + 1}–${Math.min(jobsPage * JOBS_PAGE_SIZE, jobsTotal)} of ${jobsTotal}`
              : `${s?.jobs ?? 0} jobs`}
          </span>
        </header>
        {!jobs.length ? (
          <p className="op-auto-empty">No jobs yet — Start to catalogue Vimeo sittings.</p>
        ) : (
          <>
            <ul className="op-auto-jobs">
              {jobs.map((j) => (
                <li key={j.id} className={cn("op-auto-job", `is-${j.stage}`)}>
                  <JobThumb
                    previewUrl={j.previewUrl}
                    platform={j.platform}
                    title={j.title}
                    stage={j.stage}
                  />
                  <div className="op-auto-job-body">
                    <strong title={j.title}>{j.title}</strong>
                    <div className="op-auto-job-meta">
                      <span>{j.country}</span>
                      <span>{j.platform}</span>
                      <span>ASR ~{eta(j.estimateAsrSec)}</span>
                      <span>{relativeTime(j.updatedAt)}</span>
                      {j.progressPct ? <span>{j.progressPct}%</span> : null}
                    </div>
                    {j.mediaUrl ? (
                      <a
                        href={j.mediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="op-auto-job-url"
                        title={j.mediaUrl}
                      >
                        {shortUrl(j.mediaUrl, 52)}
                      </a>
                    ) : null}
                    <JobError error={j.error} errorDetail={j.errorDetail} />
                  </div>
                </li>
              ))}
            </ul>
            <nav className="op-auto-pager" aria-label="Queue pages">
              <span>
                Page {jobsPage} / {jobsTotalPages}
              </span>
              <div className="op-auto-pager-controls">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="op-auto-btn"
                  disabled={jobsPage <= 1 || !!busy}
                  onClick={() => goJobsPage(jobsPage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} /> Prev
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="op-auto-btn"
                  disabled={jobsPage >= jobsTotalPages || !!busy}
                  onClick={() => goJobsPage(jobsPage + 1)}
                  aria-label="Next page"
                >
                  Next <ChevronRight size={14} />
                </Button>
              </div>
            </nav>
          </>
        )}
      </section>
    </div>
  );
}

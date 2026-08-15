"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { apiFetch, getClientApiKey, invalidateApiCache } from "@/lib/api-client";
import { AutomationControl } from "./automation-control";
import { AutomationQueue } from "./automation-queue";
import { AutomationSources } from "./automation-sources";
import { AutomationConsole } from "./automation-console";
import { AutomationMetrics } from "./automation-metrics";
import {
  JOBS_PAGE_SIZE,
  type AutoEvent,
  type AutoJob,
  type AutoSeed,
  type AutoSettings,
  type AutoSummary,
} from "./types";

type DashPayload = {
  enabled: boolean;
  dashboard: {
    summary: AutoSummary;
    jobs: {
      items: AutoJob[];
      page: number;
      total: number;
      totalPages: number;
    };
    seeds: AutoSeed[];
    settings: AutoSettings;
    hardCap: number;
    bandwidth?: { liveBps: number; movedBytes: number; downloading: number };
    events: AutoEvent[];
    server: { dryRun: boolean };
  } | null;
};

export function OperatorAutomationPanel() {
  const [summary, setSummary] = useState<AutoSummary | null>(null);
  const [jobs, setJobs] = useState<AutoJob[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsTotalPages, setJobsTotalPages] = useState(1);
  const [seeds, setSeeds] = useState<AutoSeed[]>([]);
  const [events, setEvents] = useState<AutoEvent[]>([]);
  const [settings, setSettings] = useState<AutoSettings | null>(null);
  const [hardCap, setHardCap] = useState(50);
  const [batchDraft, setBatchDraft] = useState(5);
  const [busy, setBusy] = useState<string | null>(null);
  const [seedUrl, setSeedUrl] = useState("");
  const [seedCountry, setSeedCountry] = useState("BB");
  const [showDebug, setShowDebug] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [liveBps, setLiveBps] = useState(0);
  const [peakBps, setPeakBps] = useState(0);
  const [movedBytes, setMovedBytes] = useState(0);
  const [transcript, setTranscript] = useState<{
    title: string;
    text: string;
  } | null>(null);
  const [txBusy, setTxBusy] = useState<string | null>(null);

  const settingsTimer = useRef<number | null>(null);
  const batchRef = useRef(batchDraft);
  const asrRef = useRef<AutoSettings["asrProvider"]>("auto");
  const peakRef = useRef(0);

  useEffect(() => {
    batchRef.current = batchDraft;
  }, [batchDraft]);

  const load = useCallback(
    async (soft = false, page = jobsPage) => {
      try {
        const res = await apiFetch<DashPayload>(
          `/api/operator/parliamentary-media/dashboard?page=${page}&pageSize=${JOBS_PAGE_SIZE}`,
          { skipCache: true }
        );
        const dash = res.dashboard;
        if (!dash) {
          setSummary({
            control: "idle",
            found: 0,
            queued: 0,
            downloading: 0,
            transcribing: 0,
            done: 0,
            failed: 0,
            active: 0,
            jobs: 0,
            seedsEnabled: 0,
          });
          return;
        }
        setSummary(dash.summary);
        setJobs(dash.jobs.items);
        setJobsTotal(dash.jobs.total);
        setJobsTotalPages(dash.jobs.totalPages);
        if (dash.jobs.page !== jobsPage) setJobsPage(dash.jobs.page);
        setSeeds(dash.seeds || []);
        setEvents(dash.events || []);
        setDryRun(Boolean(dash.server?.dryRun));
        const cap = Math.max(1, dash.hardCap || 50);
        setHardCap(cap);
        setSettings(dash.settings);
        asrRef.current = dash.settings.asrProvider || "auto";
        if (!settingsTimer.current) {
          const bs = Math.min(cap, Math.max(1, dash.settings.batchSize || 5));
          setBatchDraft(bs);
          batchRef.current = bs;
        }

        const live = dash.bandwidth?.liveBps ?? 0;
        const moved = dash.bandwidth?.movedBytes ?? 0;
        setLiveBps(live);
        setMovedBytes(moved);
        if (live > peakRef.current) {
          peakRef.current = live;
          setPeakBps(live);
        }
      } catch (err) {
        if (!soft) toast.error(err instanceof Error ? err.message : "Load failed");
      }
    },
    [jobsPage]
  );

  useEffect(() => {
    void load(false, jobsPage);
    const id = window.setInterval(() => void load(true, jobsPage), 1500);
    return () => window.clearInterval(id);
  }, [load, jobsPage]);

  useEffect(
    () => () => {
      if (settingsTimer.current) window.clearTimeout(settingsTimer.current);
    },
    []
  );

  function persistSettings(nextBatch: number, nextAsr: AutoSettings["asrProvider"]) {
    if (settingsTimer.current) window.clearTimeout(settingsTimer.current);
    settingsTimer.current = window.setTimeout(() => {
      settingsTimer.current = null;
      void (async () => {
        try {
          const res = await apiFetch<{ settings: AutoSettings; hardCap: number }>(
            "/api/operator/parliamentary-media/settings",
            {
              method: "POST",
              json: { batchSize: nextBatch, asrProvider: nextAsr },
            }
          );
          setSettings(res.settings);
          setHardCap(res.hardCap || hardCap);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Settings failed");
        }
      })();
    }, 400);
  }

  async function onControl(action: "start" | "pause" | "cancel") {
    setBusy(action);
    try {
      await apiFetch("/api/operator/parliamentary-media/control", {
        method: "POST",
        json: { action },
      });
      invalidateApiCache("/api/operator/parliamentary-media");
      await load(true, action === "start" || action === "cancel" ? 1 : jobsPage);
      if (action === "start" || action === "cancel") setJobsPage(1);
      if (action === "start") toast.success("Pipeline running — remaining work will continue");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Control failed");
    } finally {
      setBusy(null);
    }
  }

  async function onClear() {
    if (
      !window.confirm(
        "Clear automation? This kills the worker, deletes videos/queue/logs, and restarts idle. Sources are kept."
      )
    ) {
      return;
    }
    setBusy("clear");
    try {
      await apiFetch("/api/operator/parliamentary-media/control", {
        method: "POST",
        json: { action: "clear", confirm: true },
      });
      invalidateApiCache("/api/operator/parliamentary-media");
      setJobs([]);
      setJobsTotal(0);
      setJobsPage(1);
      setEvents([]);
      peakRef.current = 0;
      setLiveBps(0);
      setPeakBps(0);
      setMovedBytes(0);
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
        json: { url: seedUrl.trim(), country: seedCountry },
      });
      setSeedUrl("");
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Add source failed");
    } finally {
      setBusy(null);
    }
  }

  async function resetSeeds() {
    setBusy("reset");
    try {
      await apiFetch("/api/operator/parliamentary-media/seeds", {
        method: "POST",
        json: { action: "reset_verified" },
      });
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(null);
    }
  }

  async function viewTranscript(id: string) {
    setTxBusy(id);
    try {
      const res = await apiFetch<{
        transcript: { title: string; text: string };
      }>(`/api/operator/parliamentary-media/transcript?id=${encodeURIComponent(id)}`, {
        skipCache: true,
      });
      setTranscript({ title: res.transcript.title, text: res.transcript.text });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transcript unavailable");
    } finally {
      setTxBusy(null);
    }
  }

  async function downloadTranscript(id: string) {
    setTxBusy(id);
    try {
      const res = await fetch(
        `/api/operator/parliamentary-media/transcript?id=${encodeURIComponent(id)}&download=1&format=txt`,
        {
          headers: { Authorization: `Bearer ${getClientApiKey()}` },
          cache: "no-store",
        }
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${id}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setTxBusy(null);
    }
  }

  return (
    <div className="op-auto2">
      <AutomationControl
        summary={summary}
        settings={settings}
        hardCap={hardCap}
        batchDraft={batchDraft}
        busy={busy}
        onBatchChange={(n) => {
          const v = Math.min(hardCap, Math.max(1, n));
          setBatchDraft(v);
          persistSettings(v, asrRef.current);
        }}
        onAsrChange={(v) => {
          asrRef.current = v;
          setSettings((prev) => (prev ? { ...prev, asrProvider: v } : prev));
          persistSettings(batchRef.current, v);
        }}
        onControl={onControl}
        onClear={() => void onClear()}
        onRefresh={() => void load(true)}
      />

      {dryRun || summary?.lastError ? (
        <p className="op-auto2-flags">
          {dryRun ? <span className="is-warn">dry-run</span> : null}
          {summary?.lastError ? (
            <span className="is-err" title={summary.lastError}>
              {summary.lastError}
            </span>
          ) : null}
        </p>
      ) : null}

      <AutomationMetrics
        summary={summary}
        liveBps={liveBps}
        peakBps={peakBps}
        movedBytes={movedBytes}
      />

      <AutomationQueue
        jobs={jobs}
        page={jobsPage}
        totalPages={jobsTotalPages}
        total={jobsTotal}
        busyId={txBusy}
        onPage={(p) => setJobsPage(p)}
        onView={(id) => void viewTranscript(id)}
        onDownload={(id) => void downloadTranscript(id)}
      />

      <details className="op-auto2-more" open>
        <summary>Sources & console</summary>
        <div className="op-auto2-more-grid">
          <AutomationSources
            seeds={seeds}
            url={seedUrl}
            country={seedCountry}
            busy={!!busy}
            onUrl={setSeedUrl}
            onCountry={setSeedCountry}
            onAdd={() => void addSeed()}
            onReset={() => void resetSeeds()}
          />
          <AutomationConsole
            events={events}
            showDebug={showDebug}
            onToggleDebug={() => setShowDebug((v) => !v)}
          />
        </div>
      </details>

      {transcript ? (
        <div className="op-auto2-sheet" role="dialog" aria-modal="true">
          <button
            type="button"
            className="op-auto2-sheet-bg"
            aria-label="Close"
            onClick={() => setTranscript(null)}
          />
          <div className="op-auto2-sheet-panel">
            <header>
              <h3>{transcript.title}</h3>
              <button type="button" onClick={() => setTranscript(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </header>
            <pre>{transcript.text}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

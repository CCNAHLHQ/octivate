"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CONTROL_AUTOSAVE_MS,
  type AutosaveStatus,
} from "@/components/operator/autosave-status";
import { toast } from "@/components/ui/toast";
import { ApiError, apiFetch, invalidateApiCache } from "@/lib/api-client";
import { notifySourcesChanged } from "@/lib/sources/events";
import type { JobProgressSnapshot } from "@/lib/sources/job-progress";
import type { SourceProbeConfig } from "@/lib/types";

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type ProbeStats = {
  healthy: number;
  degraded: number;
  down: number;
  never: number;
  total: number;
};

export type CaptureInfo = {
  runnerReady: boolean;
  artifactsRoot: string;
  pending: number;
  pendingOnly?: number;
  running?: number;
  done?: number;
  failed?: number;
};

type CaptureMode = "stale" | "all" | "drain" | "resume";

const MAX_DRAIN_WAVES = 200;

type SourceProbeContextValue = {
  loading: boolean;
  config: SourceProbeConfig | null;
  stats: ProbeStats | null;
  capture: CaptureInfo | null;
  saveStatus: AutosaveStatus;
  probing: boolean;
  capturing: boolean;
  probeJob: JobProgressSnapshot | null;
  captureJob: JobProgressSnapshot | null;
  patchConfig: <K extends keyof SourceProbeConfig>(
    key: K,
    value: SourceProbeConfig[K]
  ) => void;
  persistNow: () => void;
  runProbe: (mode: "stale" | "all") => Promise<void>;
  runCapture: (mode: CaptureMode) => Promise<void>;
  clearCaptures: () => Promise<void>;
  reload: () => Promise<void>;
};

const SourceProbeContext = createContext<SourceProbeContextValue | null>(null);

function seedJob(
  kind: "probe" | "capture",
  label: string
): JobProgressSnapshot {
  return {
    kind,
    status: "running",
    label,
    total: 0,
    done: 0,
    failed: 0,
    succeeded: 0,
    current: "Starting…",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function SourceProbeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SourceProbeConfig | null>(null);
  const [stats, setStats] = useState<ProbeStats | null>(null);
  const [capture, setCapture] = useState<CaptureInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>("saved");
  const [probing, setProbing] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [probeJob, setProbeJob] = useState<JobProgressSnapshot | null>(null);
  const [captureJob, setCaptureJob] = useState<JobProgressSnapshot | null>(null);
  const timerRef = useRef<number | null>(null);
  const draftRef = useRef<SourceProbeConfig | null>(null);
  const savedSnapRef = useRef("");
  const saveChainRef = useRef(Promise.resolve<void>(undefined));

  const reload = useCallback(async () => {
    try {
      const [probe, cap] = await Promise.all([
        apiFetch<{ config: SourceProbeConfig; stats: ProbeStats }>(
          "/api/operator/sources/probe",
          { skipCache: true }
        ),
        apiFetch<CaptureInfo>("/api/operator/sources/capture", { skipCache: true }),
      ]);
      setConfig(probe.config);
      draftRef.current = probe.config;
      savedSnapRef.current = JSON.stringify(probe.config);
      setStats(probe.stats);
      setCapture(cap);
      setSaveStatus("saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load probe controls");
      setSaveStatus("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [reload]);

  // Real-time progress while probe/capture POSTs are in flight.
  useEffect(() => {
    if (!probing && !capturing) return;
    let cancelled = false;

    async function tick() {
      try {
        const data = await apiFetch<{
          probe: JobProgressSnapshot;
          capture: JobProgressSnapshot;
        }>("/api/operator/sources/progress", { skipCache: true });
        if (cancelled) return;
        setProbeJob(data.probe);
        setCaptureJob(data.capture);
      } catch {
        /* ignore transient poll errors */
      }
    }

    void tick();
    // Keep under operator progress rate limits (was 350ms → 429 storms).
    const id = window.setInterval(() => void tick(), 900);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [probing, capturing]);

  // Keep finished bars visible briefly, then clear.
  useEffect(() => {
    if (probing || probeJob?.status === "running") return;
    if (probeJob?.status !== "done" && probeJob?.status !== "error") return;
    const id = window.setTimeout(() => setProbeJob(null), 4200);
    return () => window.clearTimeout(id);
  }, [probing, probeJob?.status]);

  useEffect(() => {
    if (capturing || captureJob?.status === "running") return;
    if (captureJob?.status !== "done" && captureJob?.status !== "error") return;
    const id = window.setTimeout(() => setCaptureJob(null), 4200);
    return () => window.clearTimeout(id);
  }, [capturing, captureJob?.status]);

  const persist = useCallback(async (next: SourceProbeConfig) => {
    if (JSON.stringify(next) === savedSnapRef.current) {
      setSaveStatus("saved");
      return;
    }
    setSaveStatus("saving");
    try {
      const data = await apiFetch<{ config: SourceProbeConfig }>(
        "/api/operator/sources/probe",
        { method: "PATCH", json: next, skipCache: true }
      );
      if (JSON.stringify(draftRef.current) === JSON.stringify(next)) {
        setConfig(data.config);
        draftRef.current = data.config;
        savedSnapRef.current = JSON.stringify(data.config);
        setSaveStatus("saved");
      } else {
        savedSnapRef.current = JSON.stringify(data.config);
        setSaveStatus("dirty");
      }
    } catch (err) {
      setSaveStatus("error");
      toast.error(err instanceof Error ? err.message : "Failed to save probe config");
    }
  }, []);

  const scheduleSave = useCallback(
    (next: SourceProbeConfig) => {
      draftRef.current = next;
      setConfig(next);
      setSaveStatus((s) => (s === "saving" ? "saving" : "dirty"));
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        const payload = draftRef.current;
        if (!payload) return;
        saveChainRef.current = saveChainRef.current
          .then(() => persist(payload))
          .catch(() => undefined);
      }, CONTROL_AUTOSAVE_MS);
    },
    [persist]
  );

  const patchConfig = useCallback(
    <K extends keyof SourceProbeConfig>(key: K, value: SourceProbeConfig[K]) => {
      const base = draftRef.current;
      if (!base) return;
      scheduleSave({ ...base, [key]: value });
    },
    [scheduleSave]
  );

  const persistNow = useCallback(() => {
    if (draftRef.current) void persist(draftRef.current);
  }, [persist]);

  const runProbe = useCallback(async (mode: "stale" | "all") => {
    setProbing(true);
    setProbeJob(
      seedJob(
        "probe",
        mode === "all" ? "Checking all sources" : "Checking stale sources"
      )
    );
    try {
      let data: {
        report: { checked: number; healthy: number; degraded: number; down: number };
        stats: ProbeStats;
      } | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          data = await apiFetch<{
            report: { checked: number; healthy: number; degraded: number; down: number };
            stats: ProbeStats;
          }>("/api/operator/sources/probe", {
            method: "POST",
            json: { mode },
            skipCache: true,
          });
          break;
        } catch (err) {
          if (err instanceof ApiError && err.status === 429) {
            await wait((err.retryAfterSec || 2) * 1000);
            continue;
          }
          throw err;
        }
      }
      if (!data) throw new ApiError("Too Many Requests", 429);

      setStats(data.stats);
      invalidateApiCache("/api/sources");
      toast.success(
        `Checked ${data.report.checked}: ${data.report.healthy} up · ${data.report.degraded} degraded · ${data.report.down} down`
      );
      notifySourcesChanged();
      try {
        const progress = await apiFetch<{ probe: JobProgressSnapshot }>(
          "/api/operator/sources/progress",
          { skipCache: true }
        );
        setProbeJob(progress.probe);
      } catch {
        /* keep last polled */
      }
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 429
          ? "Too many requests — wait a moment and try again"
          : err instanceof Error
            ? err.message
            : "Probe failed";
      toast.error(message);
      setProbeJob((prev) =>
        prev
          ? {
              ...prev,
              status: "error",
              label: message,
              finishedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : prev
      );
    } finally {
      setProbing(false);
    }
  }, []);

  const runCapture = useCallback(
    async (mode: CaptureMode) => {
      setCapturing(true);
      const startLabel =
        mode === "all"
          ? "Capturing all sources"
          : mode === "resume"
            ? "Resuming pending captures"
            : mode === "drain"
              ? "Draining capture queue"
              : "Capturing sources";
      setCaptureJob(seedJob("capture", startLabel));

      async function postCapture(nextMode: CaptureMode) {
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            return await apiFetch<{
              queued: number;
              recovered?: number;
              processed: number;
              failed: number;
              succeeded?: number;
              pending?: number;
              reason?: string;
              runnerReady: boolean;
            }>("/api/operator/sources/capture", {
              method: "POST",
              json: { mode: nextMode },
              skipCache: true,
            });
          } catch (err) {
            if (err instanceof ApiError && err.status === 429) {
              await wait((err.retryAfterSec || 2) * 1000);
              continue;
            }
            throw err;
          }
        }
        throw new ApiError("Too Many Requests", 429);
      }

      try {
        let data = await postCapture(mode);
        if (data.reason === "capture_disabled") {
          toast.warning("Enable capture in settings first");
          return;
        }
        if (data.reason === "chromium_not_found") {
          toast.warning(
            "Chromium/Edge not found — set CHROMIUM_PATH or install Microsoft Edge"
          );
          return;
        }
        if (data.reason === "capture_not_configured") {
          toast.warning("Capture runner is not ready yet");
          return;
        }
        if (data.reason === "queue_empty") {
          toast.warning("No pending captures to resume");
          return;
        }

        let ok = data.succeeded ?? Math.max(0, data.processed - data.failed);
        let failed = data.failed;
        let queued = data.queued;
        let recovered = data.recovered ?? 0;
        let waves = 1;

        // Keep draining until the durable queue is empty (each request runs several waves).
        while ((data.pending ?? 0) > 0 && waves < MAX_DRAIN_WAVES) {
          waves += 1;
          data = await postCapture("drain");
          ok += data.succeeded ?? Math.max(0, data.processed - data.failed);
          failed += data.failed;
          recovered += data.recovered ?? 0;
        }

        const stillPending = data.pending ?? 0;
        const prefix = mode === "resume" ? "Resume" : "Capture";
        const msg = `${prefix} · ${ok} saved · ${failed} failed${
          queued ? ` · ${queued} queued` : ""
        }${recovered ? ` · ${recovered} unstuck` : ""}${
          stillPending > 0 ? ` · ${stillPending} still pending` : ""
        }`;
        if (ok > 0 && failed === 0 && stillPending === 0) toast.success(msg);
        else if (ok > 0 || recovered > 0) toast.warning(msg);
        else if (queued === 0 && ok === 0 && failed === 0 && recovered === 0)
          toast.warning("Nothing to capture — queue is empty or already complete");
        else toast.error(msg);

        try {
          const progress = await apiFetch<{ capture: JobProgressSnapshot }>(
            "/api/operator/sources/progress",
            { skipCache: true }
          );
          setCaptureJob(progress.capture);
        } catch {
          /* keep last polled */
        }
        await reload();
        notifySourcesChanged();
        invalidateApiCache("/api/sources");
      } catch (err) {
        const message =
          err instanceof ApiError && err.status === 429
            ? "Too many requests — wait a moment and try again"
            : err instanceof Error
              ? err.message
              : "Capture failed";
        toast.error(message);
        setCaptureJob((prev) =>
          prev
            ? {
                ...prev,
                status: "error",
                label: message,
                finishedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : prev
        );
      } finally {
        setCapturing(false);
      }
    },
    [reload]
  );

  const clearCaptures = useCallback(async () => {
    try {
      const data = await apiFetch<{
        queueCleared: number;
        artifactsRemoved: number;
        artifactsFailed?: number;
        sourcesReset: number;
        reason?: string;
      }>("/api/operator/sources/capture", {
        method: "DELETE",
        skipCache: true,
      });
      setCaptureJob(null);
      const locked = data.artifactsFailed ?? 0;
      if (data.reason === "capture_delete_busy") {
        toast.warning(
          "Queue cleared, but artifact folders are still locked. Try Delete all again in a moment."
        );
      } else if (data.reason === "capture_delete_partial" || locked > 0) {
        toast.warning(
          `Cleared queue · removed ${data.artifactsRemoved} · ${locked} still locked · reset ${data.sourcesReset} sources`
        );
      } else {
        toast.success(
          `Cleared ${data.queueCleared} queue · ${data.artifactsRemoved} bundles · ${data.sourcesReset} sources`
        );
      }
      await reload();
      notifySourcesChanged();
      invalidateApiCache("/api/sources");
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes("capture_delete_busy")) {
        toast.warning(
          "Could not delete artifacts while files are in use. Wait a moment and try again."
        );
      } else if (raw.includes("capture_delete_failed")) {
        toast.error("Could not clear capture data. Try again shortly.");
      } else if (/[a-z]:\\/i.test(raw) || raw.includes("/") || raw.includes("\\")) {
        toast.error("Could not clear capture data. Try again shortly.");
      } else {
        toast.error(raw || "Failed to clear captures");
      }
    }
  }, [reload]);

  const value = useMemo(
    () => ({
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
      reload,
    }),
    [
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
      reload,
    ]
  );

  return (
    <SourceProbeContext.Provider value={value}>{children}</SourceProbeContext.Provider>
  );
}

export function useSourceProbe() {
  const ctx = useContext(SourceProbeContext);
  if (!ctx) {
    throw new Error("useSourceProbe must be used within SourceProbeProvider");
  }
  return ctx;
}

export function useOptionalSourceProbe() {
  return useContext(SourceProbeContext);
}

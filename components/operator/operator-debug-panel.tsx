"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bot,
  Bug,
  ChevronDown,
  ChevronUp,
  Eraser,
  Filter,
  KeyRound,
  LifeBuoy,
  Mail,
  Pause,
  Play,
  RefreshCw,
  Shield,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { apiFetch, getClientApiKey } from "@/lib/api-client";
import type { OpsEvent, OpsEventLevel, OpsEventSource } from "@/lib/ops/event-log";
import { cn } from "@/lib/utils";

const SOURCES: { id: OpsEventSource | "all"; label: string; icon: typeof Bug }[] = [
  { id: "all", label: "All", icon: Terminal },
  { id: "openrouter", label: "OpenRouter", icon: KeyRound },
  { id: "pipeline", label: "Pipeline", icon: Bot },
  { id: "audit", label: "Audit", icon: Shield },
  { id: "support", label: "Support", icon: LifeBuoy },
  { id: "mail", label: "Mail", icon: Mail },
  { id: "system", label: "System", icon: Activity },
  { id: "security", label: "Security", icon: Shield },
];

const LEVELS: { id: OpsEventLevel | "all"; label: string }[] = [
  { id: "all", label: "All levels" },
  { id: "error", label: "Error" },
  { id: "warn", label: "Warn" },
  { id: "info", label: "Info" },
  { id: "debug", label: "Debug" },
];

const DEBUG_INITIAL = 24;
const DEBUG_STEP = 24;

function sourceIcon(source: OpsEventSource) {
  return SOURCES.find((s) => s.id === source)?.icon || Bug;
}

export function OperatorDebugPanel() {
  const [events, setEvents] = useState<OpsEvent[]>([]);
  const [source, setSource] = useState<OpsEventSource | "all">("all");
  const [level, setLevel] = useState<OpsEventLevel | "all">("all");
  const [live, setLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [visible, setVisible] = useState(DEBUG_INITIAL);
  const scroller = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ limit: "150" });
    if (source !== "all") qs.set("source", source);
    if (level !== "all") qs.set("level", level);
    const res = await apiFetch<{ events: OpsEvent[] }>(`/api/operator/logs?${qs}`, {
      skipCache: true,
    });
    setEvents(res.events || []);
  }, [source, level]);

  useEffect(() => {
    void load()
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load logs"))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!live) return;
    const key = getClientApiKey();
    const url = `/api/operator/logs/stream`;
    // EventSource cannot set Authorization; use fetch stream when key required.
    const ctrl = new AbortController();
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch(url, {
          headers: key ? { Authorization: `Bearer ${key}` } : {},
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const chunks = buf.split("\n\n");
          buf = chunks.pop() || "";
          for (const chunk of chunks) {
            const line = chunk.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            try {
              const payload = JSON.parse(line.slice(6)) as {
                type: string;
                events?: OpsEvent[];
                event?: OpsEvent;
              };
              if (payload.type === "snapshot" && payload.events) {
                setEvents(payload.events);
              } else if (payload.type === "event" && payload.event) {
                const evt = payload.event;
                setEvents((prev) => {
                  if (source !== "all" && evt.source !== source) return prev;
                  if (level !== "all" && evt.level !== level) return prev;
                  return [evt, ...prev.filter((e) => e.id !== evt.id)].slice(0, 200);
                });
              }
            } catch {
              /* ignore parse */
            }
          }
        }
      } catch {
        /* aborted or network */
      }
    }

    void run();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [live, source, level]);

  const filtered = useMemo(() => events, [events]);
  const shown = filtered.slice(0, visible);
  const remaining = Math.max(0, filtered.length - visible);

  useEffect(() => {
    setVisible(DEBUG_INITIAL);
  }, [source, level]);

  async function clearLogs() {
    setClearing(true);
    try {
      await apiFetch<{ cleared: number }>("/api/operator/logs", { method: "DELETE" });
      setEvents([]);
      toast.success("Ops log cleared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="op-debug">
      <div className="op-debug-toolbar">
        <div className="op-debug-title-row">
          <Terminal className="h-4 w-4 text-tide" aria-hidden />
          <div>
            <h2 className="op-debug-title">Live debug console</h2>
            <p className="op-debug-sub">
              Unified OpenRouter, pipeline, audit, support, and security events. Secrets are
              redacted.
            </p>
          </div>
        </div>
        <div className="op-debug-actions">
          <Tooltip content={live ? "Pause live stream" : "Resume live stream"}>
            <Button size="sm" variant="ghost" onClick={() => setLive((v) => !v)}>
              {live ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {live ? "Live" : "Paused"}
            </Button>
          </Tooltip>
          <Tooltip content="Reload snapshot">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void load().then(() => toast.success("Logs refreshed"))}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content="Clear all ops events from memory and disk">
            <Button
              size="sm"
              variant="ghost"
              className="text-coral"
              disabled={clearing}
              onClick={() => void clearLogs()}
            >
              <Eraser className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="op-debug-filters">
        <span className="op-debug-filter-label">
          <Filter className="h-3 w-3" aria-hidden />
          Source
        </span>
        <div className="op-debug-chips">
          {SOURCES.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                className={cn("op-strip-chip", source === s.id && "is-active")}
                onClick={() => setSource(s.id)}
              >
                <Icon className="h-3 w-3" aria-hidden />
                {s.label}
              </button>
            );
          })}
        </div>
        <div className="op-debug-chips">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={cn("op-strip-chip", level === l.id && "is-active")}
              onClick={() => setLevel(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="op-debug-feed">
        <div className="op-debug-list" ref={scroller}>
          {loading ? (
            <p className="op-debug-empty">Loading events…</p>
          ) : filtered.length === 0 ? (
            <p className="op-debug-empty">
              No events yet. Run a pipeline or refresh health — threat model: operator Bearer
              required; secrets never stored in this feed.
            </p>
          ) : (
            shown.map((evt) => {
              const Icon = sourceIcon(evt.source);
              const open = expanded === evt.id;
              return (
                <button
                  key={evt.id}
                  type="button"
                  className={cn("op-debug-row", `is-${evt.level}`, open && "is-open")}
                  onClick={() => setExpanded(open ? null : evt.id)}
                >
                  <span className="op-debug-row-ico" aria-hidden>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="op-debug-row-time">
                    {new Date(evt.at).toLocaleTimeString()}
                  </span>
                  <span className="op-debug-row-level">{evt.level}</span>
                  <span className="op-debug-row-source">{evt.source}</span>
                  <span className="op-debug-row-msg">{evt.message}</span>
                  {open && evt.meta ? (
                    <pre className="op-debug-meta">{JSON.stringify(evt.meta, null, 2)}</pre>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        {!loading && filtered.length > DEBUG_INITIAL ? (
          <div className="op-compact-foot">
            {remaining > 0 ? (
              <button
                type="button"
                className="op-compact-more"
                onClick={() => setVisible((v) => Math.min(filtered.length, v + DEBUG_STEP))}
              >
                <span>Show more</span>
                <span className="op-compact-more-count">{remaining} older events</span>
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                className="op-compact-more is-collapse"
                onClick={() => {
                  setVisible(DEBUG_INITIAL);
                  scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <span>Show less</span>
                <ChevronUp className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

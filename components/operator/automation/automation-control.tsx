"use client";

import { Loader2, Pause, Play, RefreshCw, Square, Trash2 } from "lucide-react";
import type { AutoSettings, AutoSummary } from "./types";

export function AutomationControl({
  summary,
  settings,
  hardCap,
  batchDraft,
  busy,
  onBatchChange,
  onAsrChange,
  onControl,
  onClear,
  onRefresh,
}: {
  summary: AutoSummary | null;
  settings: AutoSettings | null;
  hardCap: number;
  batchDraft: number;
  busy: string | null;
  onBatchChange: (n: number) => void;
  onAsrChange: (v: AutoSettings["asrProvider"]) => void;
  onControl: (action: "start" | "pause" | "cancel") => void;
  onClear: () => void;
  onRefresh: () => void;
}) {
  const state = summary?.effectiveControl || summary?.control || "idle";
  const running = state === "running" || state === "cancelling";

  return (
    <header className="op-auto2-control">
      <div className="op-auto2-control-main">
        <h2 className="op-auto2-title">Automation</h2>
        <span className="op-auto2-state" data-state={state}>
          {state}
        </span>
      </div>

      <div className="op-auto2-settings">
        <label>
          Batch
          <input
            type="number"
            min={1}
            max={hardCap}
            value={batchDraft}
            disabled={!!busy}
            onChange={(e) => onBatchChange(Number(e.target.value) || 1)}
          />
        </label>
        <label>
          ASR
          <select
            value={settings?.asrProvider || "auto"}
            disabled={!!busy}
            onChange={(e) =>
              onAsrChange(e.target.value as AutoSettings["asrProvider"])
            }
          >
            <option value="auto">auto</option>
            <option value="openrouter">openrouter</option>
            <option value="local">local</option>
          </select>
        </label>
      </div>

      <div className="op-auto2-actions">
        <button
          type="button"
          className="op-auto2-btn is-primary"
          disabled={!!busy || running}
          onClick={() => onControl("start")}
        >
          {busy === "start" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Start
        </button>
        <button
          type="button"
          className="op-auto2-btn"
          disabled={!!busy || state !== "running"}
          onClick={() => onControl("pause")}
        >
          <Pause className="h-3.5 w-3.5" />
          Pause
        </button>
        <button
          type="button"
          className="op-auto2-btn is-warn"
          disabled={!!busy || state === "idle"}
          onClick={() => onControl("cancel")}
        >
          <Square className="h-3.5 w-3.5" />
          Cancel
        </button>
        <button
          type="button"
          className="op-auto2-btn is-danger"
          disabled={!!busy}
          onClick={onClear}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>
        <button
          type="button"
          className="op-auto2-btn is-ghost"
          disabled={!!busy}
          onClick={onRefresh}
          aria-label="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}

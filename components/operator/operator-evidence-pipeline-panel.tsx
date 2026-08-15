"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Database, RotateCcw } from "lucide-react";
import {
  AutosaveStatusPill,
  CONTROL_AUTOSAVE_MS,
  type AutosaveStatus,
} from "@/components/operator/autosave-status";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tooltip } from "@/components/ui/tooltip";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import type { ScoringPolicy } from "@/lib/evidence/types";
import { DEFAULT_SCORING_POLICY } from "@/lib/evidence/types";
import { cn } from "@/lib/utils";

type WeightKey = Exclude<keyof ScoringPolicy, "localOnlySourcesDefault">;

const WEIGHTS: {
  key: WeightKey;
  label: string;
  tip: string;
}[] = [
  {
    key: "sourceScoreW",
    label: "Source scores",
    tip: "scoreBriefConfidence · blends registry totalSourceScore / reliability on selected SourceRecords",
  },
  {
    key: "labelMatchW",
    label: "Label match",
    tip: "labelCoverageScore · keyword indicators from Curate Source (PSN / sector / relevance) on capture text",
  },
  {
    key: "agentConfW",
    label: "Agent confidence",
    tip: "Doctrine overall_confidence labels from PSN / recommendation agents",
  },
  {
    key: "triangulationW",
    label: "Triangulation",
    tip: "Share of Power / Systems / Narrative lenses that returned usable (non-insufficient) findings",
  },
  {
    key: "freshnessW",
    label: "Freshness",
    tip: "Recency of lastCaptureAt / healthCheckedAt / evidence capturedAt (≤7d full credit)",
  },
];

function snap(p: ScoringPolicy) {
  return JSON.stringify(p);
}

function sharePct(policy: ScoringPolicy, key: WeightKey): number {
  const sum =
    policy.sourceScoreW +
    policy.labelMatchW +
    policy.agentConfW +
    policy.triangulationW +
    policy.freshnessW;
  if (sum <= 0) return 0;
  return Math.round((policy[key] / sum) * 100);
}

export function OperatorEvidencePipelinePanel() {
  const [policy, setPolicy] = useState<ScoringPolicy>(DEFAULT_SCORING_POLICY);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>("saved");

  const policyRef = useRef(policy);
  const savedSnapRef = useRef("");
  const saveTimerRef = useRef<number | null>(null);
  const saveChainRef = useRef(Promise.resolve<void>(undefined));

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const persistNow = useCallback(async () => {
    const body = policyRef.current;
    if (snap(body) === savedSnapRef.current) {
      setSaveStatus("saved");
      return;
    }
    setSaveStatus("saving");
    try {
      const res = await apiFetch<{ policy: ScoringPolicy }>("/api/operator/scoring-policy", {
        method: "PATCH",
        json: body,
      });
      policyRef.current = res.policy;
      savedSnapRef.current = snap(res.policy);
      setPolicy(res.policy);
      setSaveStatus("saved");
      invalidateApiCache("/api/operator/scoring-policy");
    } catch {
      setSaveStatus("error");
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (snap(policyRef.current) !== savedSnapRef.current) {
      setSaveStatus((s) => (s === "saving" ? "saving" : "dirty"));
    }
    clearSaveTimer();
    saveTimerRef.current = window.setTimeout(() => {
      saveChainRef.current = saveChainRef.current.then(() => persistNow()).catch(() => undefined);
    }, CONTROL_AUTOSAVE_MS);
  }, [clearSaveTimer, persistNow]);

  const flushSave = useCallback(() => {
    clearSaveTimer();
    saveChainRef.current = saveChainRef.current.then(() => persistNow()).catch(() => undefined);
  }, [clearSaveTimer, persistNow]);

  useEffect(() => {
    void apiFetch<{ policy: ScoringPolicy }>("/api/operator/scoring-policy", { skipCache: true })
      .then((res) => {
        const next = res.policy || DEFAULT_SCORING_POLICY;
        policyRef.current = next;
        savedSnapRef.current = snap(next);
        setPolicy(next);
        setSaveStatus("saved");
      })
      .catch(() => setSaveStatus("error"))
      .finally(() => setLoading(false));
    return () => clearSaveTimer();
  }, [clearSaveTimer]);

  function setWeight(key: WeightKey, value: number) {
    setPolicy((prev) => {
      const next = { ...prev, [key]: value };
      policyRef.current = next;
      return next;
    });
    scheduleSave();
  }

  function setLocalOnlyDefault(on: boolean) {
    setPolicy((prev) => {
      const next = { ...prev, localOnlySourcesDefault: on };
      policyRef.current = next;
      return next;
    });
    scheduleSave();
    flushSave();
  }

  async function resetDefaults() {
    clearSaveTimer();
    const next = { ...DEFAULT_SCORING_POLICY };
    setPolicy(next);
    policyRef.current = next;
    setSaveStatus("saving");
    try {
      const res = await apiFetch<{ policy: ScoringPolicy }>("/api/operator/scoring-policy", {
        method: "PATCH",
        json: next,
      });
      policyRef.current = res.policy;
      savedSnapRef.current = snap(res.policy);
      setPolicy(res.policy);
      setSaveStatus("saved");
      invalidateApiCache("/api/operator/scoring-policy");
    } catch {
      setSaveStatus("error");
    }
  }

  if (loading) {
    return <p className="op-slider-panel-loading">Loading weights…</p>;
  }

  const localOnly = policy.localOnlySourcesDefault === true;

  return (
    <div className="op-slider-panel">
      <button
        type="button"
        role="switch"
        aria-checked={localOnly}
        className={cn("op-policy-card", localOnly && "is-on", "is-teal", "op-evidence-policy")}
        onClick={() => setLocalOnlyDefault(!localOnly)}
      >
        <div className="op-policy-card-main">
          <span className={cn("op-limit-ico", "is-teal")}>
            <Database className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 text-left">
            <div className="op-policy-card-top">
              <Tooltip
                content="When on, project runs cite only capture artifacts, parliamentary transcripts, and project uploads with stored text — registry URL-only rows are dropped."
                side="top"
              >
                <h4 className="op-limit-title">Local sources only</h4>
              </Tooltip>
              <StatusBadge tone={localOnly ? "teal" : "mist"}>
                {localOnly ? "Default on" : "Off"}
              </StatusBadge>
            </div>
            <p className="op-limit-desc">
              Cite capture artifacts, parliamentary transcripts, and project uploads with stored
              text (drop registry URL-only rows).
            </p>
          </div>
        </div>
        <span className="op-toggle-track" data-on={localOnly ? "true" : "false"} aria-hidden>
          <span className="op-toggle-thumb" />
        </span>
      </button>

      <ul className="op-slider-list">
        {WEIGHTS.map((w) => (
          <li key={w.key} className="op-slider-row">
            <div className="op-slider-meta">
              <Tooltip content={w.tip} side="top">
                <span className="op-slider-label">{w.label}</span>
              </Tooltip>
              <span className="op-slider-value" aria-live="polite">
                {policy[w.key]}
                <em>{sharePct(policy, w.key)}%</em>
              </span>
            </div>
            <input
              type="range"
              className="op-model-range"
              min={0}
              max={100}
              step={1}
              value={policy[w.key]}
              aria-label={w.label}
              draggable={false}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => setWeight(w.key, Number(e.target.value))}
              onMouseUp={flushSave}
              onTouchEnd={flushSave}
              onKeyUp={(e) => {
                if (
                  e.key === "ArrowLeft" ||
                  e.key === "ArrowRight" ||
                  e.key === "Home" ||
                  e.key === "End"
                ) {
                  flushSave();
                }
              }}
            />
          </li>
        ))}
      </ul>

      <div className="op-slider-footer">
        <AutosaveStatusPill
          status={saveStatus}
          onRetry={() => {
            void persistNow();
          }}
        />
        <Tooltip content="Restore default ScoringPolicy (25/20/30/15/10) used by scoreBriefConfidence">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="Reset scoring weights"
            onClick={() => void resetDefaults()}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

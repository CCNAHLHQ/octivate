"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  AutosaveStatusPill,
  CONTROL_AUTOSAVE_MS,
  type AutosaveStatus,
} from "@/components/operator/autosave-status";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { apiFetch, invalidateApiCache } from "@/lib/api-client";
import type {
  DocsFeatureClass,
  ModelConfig,
  ReasoningEffort,
} from "@/lib/openrouter/model-config-store";
import { cn } from "@/lib/utils";

function snapshot(config: ModelConfig) {
  return JSON.stringify(config);
}

type DocsMode = "off" | "summarize" | "focus" | "full";

function docsModeFrom(docs: DocsFeatureClass): DocsMode {
  if (!docs.enabled) return "off";
  if (docs.allowRework) return "full";
  if (docs.allowFocus) return "focus";
  return "summarize";
}

function docsFromMode(mode: DocsMode, prev: DocsFeatureClass): DocsFeatureClass {
  if (mode === "off") return { ...prev, enabled: false, allowFocus: false, allowRework: false };
  if (mode === "summarize") return { ...prev, enabled: true, allowFocus: false, allowRework: false };
  if (mode === "focus") return { ...prev, enabled: true, allowFocus: true, allowRework: false };
  return { ...prev, enabled: true, allowFocus: true, allowRework: true };
}

function shortModel(slug: string): string {
  const leaf = slug.split("/").pop() || slug;
  return leaf.length > 42 ? `${leaf.slice(0, 40)}…` : leaf;
}

function modelOptions(allowlist: string[]) {
  return allowlist.map((m) => ({
    value: m,
    label: shortModel(m),
    keywords: [m, m.split("/")[0] || "", ...m.split(/[\/\-:_]/g)],
  }));
}

function SliderField({
  label,
  tip,
  value,
  display,
  min,
  max,
  step,
  onChange,
  onCommit,
  disabled,
}: {
  label: string;
  tip: string;
  value: number;
  display?: string;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  onCommit: () => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn("op-slider-row", disabled && "is-disabled")}>
      <div className="op-slider-meta">
        <Tooltip content={tip} side="top">
          <span className="op-slider-label">{label}</span>
        </Tooltip>
        <span className="op-slider-value">{display ?? value}</span>
      </div>
      <input
        type="range"
        className="op-model-range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        draggable={false}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
      />
    </label>
  );
}

export function OperatorModelConfigPanel({ embedded = false }: { embedded?: boolean }) {
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>("saved");

  const configRef = useRef<ModelConfig | null>(null);
  const savedSnapRef = useRef("");
  const saveTimerRef = useRef<number | null>(null);
  const saveChainRef = useRef(Promise.resolve<void>(undefined));

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    const res = await apiFetch<{ config: ModelConfig }>("/api/operator/model-config", {
      skipCache: true,
    });
    configRef.current = res.config;
    savedSnapRef.current = snapshot(res.config);
    setConfig(res.config);
    setSaveStatus("saved");
  }, []);

  useEffect(() => {
    void load()
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load models"))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => () => clearSaveTimer(), [clearSaveTimer]);

  const persistNow = useCallback(async () => {
    const body = configRef.current;
    if (!body) return;
    if (snapshot(body) === savedSnapRef.current) {
      setSaveStatus("saved");
      return;
    }

    setSaveStatus("saving");
    try {
      const res = await apiFetch<{ config: ModelConfig }>("/api/operator/model-config", {
        method: "PATCH",
        json: body,
      });
      configRef.current = res.config;
      savedSnapRef.current = snapshot(res.config);
      setConfig(res.config);
      setSaveStatus("saved");
      invalidateApiCache("/api/operator/model-config");
    } catch (err) {
      setSaveStatus("error");
      toast.error(err instanceof Error ? err.message : "Autosave failed");
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (!configRef.current) return;
    if (snapshot(configRef.current) !== savedSnapRef.current) {
      setSaveStatus((status) => (status === "saving" ? "saving" : "dirty"));
    }
    clearSaveTimer();
    saveTimerRef.current = window.setTimeout(() => {
      saveChainRef.current = saveChainRef.current
        .then(() => persistNow())
        .catch(() => undefined);
    }, CONTROL_AUTOSAVE_MS);
  }, [clearSaveTimer, persistNow]);

  const flushSave = useCallback(() => {
    clearSaveTimer();
    saveChainRef.current = saveChainRef.current
      .then(() => persistNow())
      .catch(() => undefined);
  }, [clearSaveTimer, persistNow]);

  function patch(p: Partial<ModelConfig>) {
    setConfig((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...p };
      configRef.current = next;
      return next;
    });
    scheduleSave();
  }

  function patchDocs(p: Partial<DocsFeatureClass>) {
    setConfig((prev) => {
      if (!prev) return prev;
      const next = { ...prev, docs: { ...prev.docs, ...p } };
      configRef.current = next;
      return next;
    });
    scheduleSave();
  }

  async function reset() {
    clearSaveTimer();
    setResetting(true);
    try {
      const res = await apiFetch<{ config: ModelConfig }>("/api/operator/model-config", {
        method: "PATCH",
        json: { reset: true },
      });
      configRef.current = res.config;
      savedSnapRef.current = snapshot(res.config);
      setConfig(res.config);
      setSaveStatus("saved");
      toast.success("Recommended models restored");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  const allowlistOptions = useMemo(
    () => modelOptions(config?.allowlist || []),
    [config?.allowlist]
  );

  if (loading || !config) {
    return <p className="op-slider-panel-loading">Loading models…</p>;
  }

  const docs = config.docs;
  const docsMode = docsModeFrom(docs);

  return (
    <div className={cn("op-model-config op-slider-panel", embedded && "is-embedded")}>
      <div className="op-model-grid">
        <label className="op-model-field">
          <Tooltip content="resolveModel(false) · free path for doctrine when premium is not requested">
            <span>Default</span>
          </Tooltip>
          <SearchableSelect
            value={config.defaultModel}
            onChange={(next) => patch({ defaultModel: next })}
            options={allowlistOptions}
            searchPlaceholder="Search models…"
            panelMaxHeight={280}
          />
        </label>
        <label className="op-model-field">
          <Tooltip content="resolveModel(true) · used when Limits allow premium and the project opts in (usePaidModel)">
            <span>Premium</span>
          </Tooltip>
          <SearchableSelect
            value={config.premiumModel}
            onChange={(next) => patch({ premiumModel: next })}
            options={allowlistOptions}
            searchPlaceholder="Search models…"
            panelMaxHeight={280}
          />
        </label>
        <label className="op-model-field">
          <Tooltip content="getFallbackOpenRouterModel · retry slug after empty / soft-fail completions">
            <span>Fallback</span>
          </Tooltip>
          <SearchableSelect
            value={config.fallbackModel}
            onChange={(next) => patch({ fallbackModel: next })}
            options={allowlistOptions}
            searchPlaceholder="Search models…"
            panelMaxHeight={280}
          />
        </label>
        <label className="op-model-field">
          <Tooltip content="OpenRouter reasoning_effort for models that support it">
            <span>Reasoning</span>
          </Tooltip>
          <Select
            value={config.reasoningEffort}
            onChange={(e) => patch({ reasoningEffort: e.target.value as ReasoningEffort })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </label>
      </div>

      <div className="op-model-feature">
        <div className="op-model-grid">
          <label className="op-model-field">
            <Tooltip content="getDocsFeatureClass · gates summarize / focus / rework on project documents">
              <span>Docs mode</span>
            </Tooltip>
            <Select
              value={docsMode}
              onChange={(e) => patchDocs(docsFromMode(e.target.value as DocsMode, docs))}
            >
              <option value="off">Off</option>
              <option value="summarize">Summarize</option>
              <option value="focus">+ Focus</option>
              <option value="full">+ Rework</option>
            </Select>
          </label>
          <label className="op-model-field">
            <Tooltip content="resolveDocsModel · extract/summarize feature class (not doctrine premium)">
              <span>Docs model</span>
            </Tooltip>
            <SearchableSelect
              value={docs.model}
              disabled={!docs.enabled}
              onChange={(next) => patchDocs({ model: next })}
              options={allowlistOptions}
              searchPlaceholder="Search models…"
              panelMaxHeight={280}
            />
          </label>
        </div>
        <SliderField
          label="Docs tokens"
          tip="resolveDocsMaxTokens · max completion tokens for document summarize"
          value={docs.maxTokens}
          min={512}
          max={4000}
          step={64}
          disabled={!docs.enabled}
          onChange={(n) => patchDocs({ maxTokens: n })}
          onCommit={flushSave}
        />
      </div>

      <ul className="op-slider-list">
        <SliderField
          label="Temperature"
          tip="resolveTemperature · sampling temperature on OpenRouter completions"
          value={config.temperature}
          display={config.temperature.toFixed(2)}
          min={0}
          max={1.5}
          step={0.05}
          onChange={(n) => patch({ temperature: n })}
          onCommit={flushSave}
        />
        <SliderField
          label="Doctrine tokens"
          tip="resolveDoctrineMaxTokens · baseline completion budget (scaled by analysis depth)"
          value={config.doctrineMaxTokens}
          min={512}
          max={16000}
          step={128}
          onChange={(n) => patch({ doctrineMaxTokens: n })}
          onCommit={flushSave}
        />
        <SliderField
          label="Reasoning tokens"
          tip="Hard cap on reasoning-capable model max_tokens when effort is enabled"
          value={config.reasoningMaxTokens}
          min={1024}
          max={32000}
          step={256}
          onChange={(n) => patch({ reasoningMaxTokens: n })}
          onCommit={flushSave}
        />
        <SliderField
          label="Reasoning budget"
          tip="reasoning.budget / max_tokens hint passed to supporting OpenRouter models"
          value={config.reasoningBudget}
          min={256}
          max={16000}
          step={128}
          onChange={(n) => patch({ reasoningBudget: n })}
          onCommit={flushSave}
        />
        <SliderField
          label="Concurrency"
          tip="lib/llm/concurrency · max in-flight OpenRouter calls across the process"
          value={config.maxConcurrent}
          min={1}
          max={12}
          step={1}
          onChange={(n) => patch({ maxConcurrent: n })}
          onCommit={flushSave}
        />
        <SliderField
          label="Timeout"
          tip="OpenRouter request timeout (ms) for live completions"
          value={config.timeoutMs}
          display={`${Math.round(config.timeoutMs / 1000)}s`}
          min={15000}
          max={300000}
          step={1000}
          onChange={(n) => patch({ timeoutMs: n })}
          onCommit={flushSave}
        />
      </ul>

      <div className="op-slider-footer">
        <AutosaveStatusPill
          status={saveStatus}
          onRetry={() => {
            void persistNow();
          }}
        />
        <Tooltip content="Restore recommended allowlist defaults (Nemotron free + docs flash)">
          <Button
            size="sm"
            variant="ghost"
            disabled={resetting}
            aria-label="Reset model routing"
            onClick={() => void reset()}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

"use client";

import {
  Activity,
  Bot,
  Crown,
  Cpu,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Health } from "@/components/operator/operator-types";
import { apiFetch } from "@/lib/api-client";
import type { ModelConfig } from "@/lib/openrouter/model-config-store";
import { cn } from "@/lib/utils";

type SignalTone = "ok" | "warn" | "alert" | "idle";

type Signal = {
  id: string;
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: SignalTone;
  status: string;
};

export function OperatorRuntimePanel({
  health,
  pipelineLabel,
  keyConfigured,
  allowPremiumModels,
}: {
  health: Health;
  pipelineLabel: string;
  keyConfigured: boolean;
  allowPremiumModels: boolean;
}) {
  const operational = health.status === "ok";
  const checked = new Date(health.time);
  const [activeModel, setActiveModel] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ config: ModelConfig }>("/api/operator/model-config")
      .then((res) => {
        const cfg = res.config;
        setActiveModel(
          allowPremiumModels ? cfg.premiumModel : cfg.defaultModel
        );
      })
      .catch(() => setActiveModel(null));
  }, [allowPremiumModels]);

  const signals: Signal[] = [
    {
      id: "service",
      icon: Activity,
      label: "API service",
      value: health.service,
      detail: `Release v${health.version}`,
      tone: operational ? "ok" : "alert",
      status: operational ? "Operational" : health.status,
    },
    {
      id: "pipeline",
      icon: Bot,
      label: "Doctrine pipeline",
      value: pipelineLabel,
      detail: keyConfigured
        ? "Live path — no mock fallback"
        : "Configure OpenRouter to unlock runs",
      tone: keyConfigured ? "ok" : "warn",
      status: keyConfigured ? "Live" : "Awaiting key",
    },
    {
      id: "openrouter",
      icon: KeyRound,
      label: "OpenRouter",
      value: keyConfigured ? "Connected" : "Not configured",
      detail: keyConfigured
        ? health.openRouter?.source
          ? `Source · ${health.openRouter.source}`
          : "API key present on server"
        : "Missing OPENROUTER_API_KEY",
      tone: keyConfigured ? "ok" : "alert",
      status: keyConfigured ? "Ready" : "Missing",
    },
    {
      id: "model",
      icon: Cpu,
      label: "Active model",
      value: activeModel || "Loading…",
      detail: allowPremiumModels
        ? "Premium routing enabled by control plane"
        : "Default routing (premium off)",
      tone: activeModel ? "ok" : "idle",
      status: allowPremiumModels ? "Premium" : "Default",
    },
    {
      id: "premium",
      icon: Crown,
      label: "Premium models",
      value: allowPremiumModels ? "Enabled" : "Standard only",
      detail: allowPremiumModels
        ? "Premium routing allowed by control plane"
        : "Limited to standard model tiers",
      tone: allowPremiumModels ? "ok" : "idle",
      status: allowPremiumModels ? "On" : "Off",
    },
  ];

  return (
    <div className="op-runtime" id="health">
      <div className={cn("op-runtime-hero", operational ? "is-ok" : "is-alert")}>
        <div className="op-runtime-hero-main">
          <span className="op-runtime-pulse" aria-hidden>
            <span className="op-runtime-pulse-ring" />
            <span className="op-runtime-pulse-dot" />
          </span>
          <div className="op-runtime-hero-copy">
            <p className="op-runtime-kicker">System status</p>
            <h3 className="op-runtime-title">
              {operational ? "All systems operational" : "Attention required"}
            </h3>
            <p className="op-runtime-lede">
              Live health from <code>/api/health</code> — pipeline, keys, and model policy at a
              glance.
            </p>
          </div>
        </div>
        <div className="op-runtime-hero-meta">
          <span className="op-runtime-chip">{operational ? "Healthy" : "Degraded"}</span>
          <time dateTime={health.time}>
            Checked {checked.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </time>
        </div>
      </div>

      <div className="op-runtime-grid">
        {signals.map((signal) => {
          const Icon = signal.icon;
          return (
            <article key={signal.id} className={cn("op-runtime-card", `is-${signal.tone}`)}>
              <div className="op-runtime-card-top">
                <span className="op-runtime-ico" aria-hidden>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="op-runtime-status">{signal.status}</span>
              </div>
              <p className="op-runtime-label">{signal.label}</p>
              <p className="op-runtime-value">{signal.value}</p>
              <p className="op-runtime-detail">{signal.detail}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

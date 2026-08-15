"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  CalendarClock,
  Crown,
  HardDrive,
  Image as ImageIcon,
  KeyRound,
  ShieldCheck,
  SlidersHorizontal,
  TextQuote,
  Upload,
  Zap,
} from "lucide-react";
import {
  AutosaveStatusPill,
  type AutosaveStatus,
} from "@/components/operator/autosave-status";
import { OperatorSection } from "@/components/operator/operator-section";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tooltip } from "@/components/ui/tooltip";
import { WorkspaceKpiStrip } from "@/components/workspace/workspace-kpi-strip";
import type { OperatorLimits, UsageSnapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

function clampInt(raw: number, min: number, max: number): number {
  if (!Number.isFinite(raw)) return min;
  return Math.min(max, Math.max(min, Math.round(raw)));
}

function LimitCard({
  icon: Icon,
  label,
  description,
  value,
  onChange,
  onCommit,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  unit,
  used,
  cap,
  tone = "violet",
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  value: number;
  onChange: (next: number) => void;
  onCommit?: () => void;
  min?: number;
  max?: number;
  unit?: string;
  used?: number;
  cap?: number;
  tone?: "violet" | "teal" | "amber";
}) {
  const safeValue = clampInt(value, min, max);
  const [draft, setDraft] = useState(String(safeValue));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(safeValue));
  }, [safeValue, focused]);

  const pct =
    used !== undefined && cap !== undefined && cap > 0
      ? Math.min(100, Math.round((used / cap) * 100))
      : null;

  function commitDraft(raw: string) {
    const parsed = Number(raw);
    const next = clampInt(Number.isFinite(parsed) ? parsed : safeValue, min, max);
    setDraft(String(next));
    if (next !== safeValue) onChange(next);
    onCommit?.();
  }

  return (
    <div className={cn("op-limit-card", tone && `is-${tone}`)}>
      <div className="op-limit-card-head">
        <span className={cn("op-limit-ico", tone && `is-${tone}`)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h4 className="op-limit-title">{label}</h4>
          <p className="op-limit-desc">{description}</p>
        </div>
      </div>

      {pct !== null && used !== undefined && cap !== undefined && (
        <div className="op-limit-meter">
          <div className="op-limit-meter-top">
            <span>{used.toLocaleString()} used today</span>
            <span className={cn(pct > 85 && "text-amber")}>{pct}% of cap</span>
          </div>
          <ProgressBar value={pct} pulse={pct > 85} />
        </div>
      )}

      <div className="op-limit-input-row">
        <Input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={draft}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            const nextDraft = e.target.value;
            setDraft(nextDraft);
            if (nextDraft.trim() === "") return;
            const parsed = Number(nextDraft);
            if (!Number.isFinite(parsed)) return;
            const rounded = Math.round(parsed);
            // Only push in-range values while typing so autosave/zod never see NaN or out-of-range drafts.
            if (rounded >= min && rounded <= max) onChange(rounded);
          }}
          onBlur={() => {
            setFocused(false);
            commitDraft(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          className="op-limit-input"
          aria-label={label}
        />
        {unit ? <span className="op-limit-unit">{unit}</span> : null}
      </div>
    </div>
  );
}

function PolicyCard({
  icon: Icon,
  title,
  description,
  tip,
  on,
  onToggle,
  badge,
  tone = "violet",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Shown on title hover — same pattern as other operator settings. */
  tip?: string;
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
      className={cn("op-policy-card", on && "is-on", tone && `is-${tone}`)}
      onClick={onToggle}
    >
      <div className="op-policy-card-main">
        <span className={cn("op-limit-ico", tone && `is-${tone}`)}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 text-left">
          <div className="op-policy-card-top">
            {tip ? (
              <Tooltip content={tip} side="top">
                <h4 className="op-limit-title">{title}</h4>
              </Tooltip>
            ) : (
              <h4 className="op-limit-title">{title}</h4>
            )}
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

export function OperatorLimitsPanel({
  limits,
  usage,
  runningSessions,
  saveStatus,
  onChange,
  onFlush,
  onRetry,
  embedded = false,
}: {
  limits: OperatorLimits;
  usage: UsageSnapshot;
  runningSessions: number;
  saveStatus: AutosaveStatus;
  onChange: (next: OperatorLimits) => void;
  onFlush?: () => void;
  onRetry?: () => void;
  embedded?: boolean;
}) {
  const tokenPct = Math.round((usage.tokensUsed / Math.max(limits.tokensPerDay, 1)) * 100);
  const agentPct = Math.round((runningSessions / Math.max(limits.concurrentAgents, 1)) * 100);

  const summaryKpis = [
    {
      label: "Token budget",
      value: `${tokenPct}%`,
      hint: `${usage.tokensUsed.toLocaleString()} / ${limits.tokensPerDay.toLocaleString()}`,
      icon: Zap,
      tone: tokenPct > 85 ? ("amber" as const) : ("violet" as const),
    },
    {
      label: "Agent slots",
      value: `${runningSessions}/${limits.concurrentAgents}`,
      hint: `${agentPct}% in use`,
      icon: Bot,
      tone: agentPct > 80 ? ("amber" as const) : ("teal" as const),
    },
    {
      label: "Uploads / project",
      value: limits.maxUploadsPerProject,
      hint: "Max documents per workspace",
      icon: Upload,
    },
    {
      label: "Max file size",
      value: `${limits.maxFileSizeMb} MB`,
      hint: "Per upload limit",
      icon: HardDrive,
    },
    {
      label: "Doc retention",
      value: `${Number(limits.documentRetentionDays) || 30}d`,
      hint: "Auto-delete after expiry",
      icon: CalendarClock,
    },
    {
      label: "Avatar cap",
      value: `${Math.max(1, Math.round((Number(limits.maxAvatarSizeKb) || 2048) / 1024))} MB`,
      hint: "Profile photo upload",
      icon: ImageIcon,
    },
  ];

  return (
    <OperatorSection
      id="limits"
      icon={SlidersHorizontal}
      title="Platform limits"
      description="Compute caps, concurrency, upload guardrails, and model policy for the live pipeline."
      embedded={embedded}
      actions={<AutosaveStatusPill status={saveStatus} onRetry={onRetry} />}
    >
      <Card className="op-limits-shell">
        <WorkspaceKpiStrip items={summaryKpis} columns={6} />

        <div className="op-limits-form">
          <div className="op-limits-layout">
            <div className="op-limits-group">
              <div className="op-limits-group-head">
                <h3 className="op-limits-group-title">Compute & throughput</h3>
                <p className="op-limits-group-desc">Daily token budget and concurrent agent capacity.</p>
              </div>
              <div className="op-limits-grid">
                <LimitCard
                  icon={Zap}
                  label="Tokens per day"
                  description="Hard cap on model tokens consumed across all sessions."
                  value={limits.tokensPerDay}
                  onChange={(tokensPerDay) => onChange({ ...limits, tokensPerDay })}
                  onCommit={onFlush}
                  min={1000}
                  max={10_000_000}
                  unit="tokens"
                  used={usage.tokensUsed}
                  cap={limits.tokensPerDay}
                  tone={tokenPct > 85 ? "amber" : "violet"}
                />
                <LimitCard
                  icon={Bot}
                  label="Concurrent agents"
                  description="Maximum simultaneous doctrine pipeline runs."
                  value={limits.concurrentAgents}
                  onChange={(concurrentAgents) => onChange({ ...limits, concurrentAgents })}
                  onCommit={onFlush}
                  min={1}
                  max={20}
                  unit="agents"
                  used={runningSessions}
                  cap={limits.concurrentAgents}
                  tone={agentPct > 80 ? "amber" : "teal"}
                />
              </div>
            </div>

            <div className="op-limits-group">
              <div className="op-limits-group-head">
                <h3 className="op-limits-group-title">Upload guardrails</h3>
                <p className="op-limits-group-desc">
                  Document intake limits and data-policy retention for project workspaces.
                </p>
              </div>
              <div className="op-limits-grid">
                <LimitCard
                  icon={Upload}
                  label="Uploads per project"
                  description="Maximum source documents attached to a single project."
                  value={limits.maxUploadsPerProject}
                  onChange={(maxUploadsPerProject) =>
                    onChange({ ...limits, maxUploadsPerProject })
                  }
                  onCommit={onFlush}
                  min={1}
                  max={200}
                  unit="files"
                  tone="teal"
                />
                <LimitCard
                  icon={HardDrive}
                  label="Max file size"
                  description="Upper bound for each uploaded document."
                  value={limits.maxFileSizeMb}
                  onChange={(maxFileSizeMb) => onChange({ ...limits, maxFileSizeMb })}
                  onCommit={onFlush}
                  min={1}
                  max={500}
                  unit="MB"
                  tone="violet"
                />
                <LimitCard
                  icon={CalendarClock}
                  label="Document retention"
                  description="Days until uploads expire and are queued for deletion. Changing this recomputes expiry for every file."
                  value={Number(limits.documentRetentionDays) || 30}
                  onChange={(documentRetentionDays) =>
                    onChange({
                      ...limits,
                      documentRetentionDays: clampInt(documentRetentionDays, 1, 3650),
                    })
                  }
                  onCommit={onFlush}
                  min={1}
                  max={3650}
                  unit="days"
                  tone="amber"
                />
              </div>
            </div>

            <div className="op-limits-group">
              <div className="op-limits-group-head">
                <h3 className="op-limits-group-title">Account profile</h3>
                <p className="op-limits-group-desc">
                  Avatar size and description length for member accounts.
                </p>
              </div>
              <div className="op-limits-grid">
                <LimitCard
                  icon={ImageIcon}
                  label="Max avatar size"
                  description="JPEG / PNG / WebP profile photos. Default 2 MB; operator max 10 MB."
                  value={Math.max(
                    1,
                    Math.round((Number(limits.maxAvatarSizeKb) || 2048) / 1024)
                  )}
                  onChange={(mb) =>
                    onChange({
                      ...limits,
                      maxAvatarSizeKb: clampInt(mb, 1, 10) * 1024,
                    })
                  }
                  onCommit={onFlush}
                  min={1}
                  max={10}
                  unit="MB"
                  tone="teal"
                />
                <LimitCard
                  icon={TextQuote}
                  label="Max bio length"
                  description="Character cap for BBCode profile descriptions."
                  value={Number(limits.maxProfileBioChars) || 2000}
                  onChange={(maxProfileBioChars) =>
                    onChange({
                      ...limits,
                      maxProfileBioChars: clampInt(maxProfileBioChars, 200, 10_000),
                    })
                  }
                  onCommit={onFlush}
                  min={200}
                  max={10_000}
                  unit="chars"
                  tone="violet"
                />
              </div>
            </div>

            <div className="op-limits-group op-limits-group-wide">
              <div className="op-limits-group-head">
                <h3 className="op-limits-group-title">Signup & account provisioning</h3>
                <p className="op-limits-group-desc">
                  Control whether public signup uses one-click credential generation.
                </p>
              </div>
              <div className="op-policy-grid">
                <PolicyCard
                  icon={KeyRound}
                  title="Autogenerate accounts"
                  description="When enabled, signup generates credentials in one click and hides Terms/Privacy plus Create account. When disabled, members use the standard form."
                  on={limits.allowAutogenerateAccounts !== false}
                  onToggle={() =>
                    onChange({
                      ...limits,
                      allowAutogenerateAccounts: !(limits.allowAutogenerateAccounts !== false),
                    })
                  }
                  badge={{
                    label:
                      limits.allowAutogenerateAccounts !== false ? "Enabled" : "Manual signup",
                    tone: limits.allowAutogenerateAccounts !== false ? "teal" : "mist",
                  }}
                  tone="teal"
                />
              </div>
            </div>

            <div className="op-limits-group op-limits-group-wide">
              <div className="op-limits-group-head">
                <h3 className="op-limits-group-title">Model & compliance policy</h3>
                <p className="op-limits-group-desc">
                  Controls premium routing and human review before briefs ship.
                </p>
              </div>
              <div className="op-policy-grid">
                <PolicyCard
                  icon={Crown}
                  title="Paid / premium models"
                  tip="When enabled, project runs may use the configured premium OpenRouter model. When off, every run stays on the free default (Nemotron)."
                  description="Use paid model when operator allows premium (default remains free Nemotron)."
                  on={limits.allowPremiumModels}
                  onToggle={() =>
                    onChange({ ...limits, allowPremiumModels: !limits.allowPremiumModels })
                  }
                  badge={{
                    label: limits.allowPremiumModels ? "Enabled" : "Free default",
                    tone: limits.allowPremiumModels ? "teal" : "mist",
                  }}
                  tone="violet"
                />
                <PolicyCard
                  icon={ShieldCheck}
                  title="Require human review"
                  tip="When required, live briefs stay pending until an operator approves publication."
                  description="Live briefs stay in review until an operator approves publication."
                  on={limits.requireHumanReview !== false}
                  onToggle={() =>
                    onChange({ ...limits, requireHumanReview: !limits.requireHumanReview })
                  }
                  badge={{
                    label: limits.requireHumanReview !== false ? "Required" : "Optional",
                    tone: limits.requireHumanReview !== false ? "amber" : "mist",
                  }}
                  tone="amber"
                />
              </div>
            </div>
          </div>

          <div className="op-limits-footer">
            <p>
              Changes autosave to the live runtime. Token and agent caps are enforced on the next
              pipeline invocation.
            </p>
            <AutosaveStatusPill status={saveStatus} onRetry={onRetry} />
          </div>
        </div>
      </Card>
    </OperatorSection>
  );
}

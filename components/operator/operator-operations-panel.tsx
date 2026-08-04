"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Bot, Coins, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, severityTone } from "@/components/ui/status-badge";
import { Tooltip } from "@/components/ui/tooltip";
import { ModerationPanel } from "@/components/dashboard/moderation-panel";
import { CompactFeed } from "@/components/operator/compact-feed";
import { OperatorEmptyState } from "@/components/operator/operator-empty-state";
import { OperatorModularBoard } from "@/components/operator/operator-module";
import { OPERATIONS_LAYOUT } from "@/components/operator/operator-layout-defaults";
import { useOperatorLayout } from "@/lib/hooks/use-operator-layout";
import type { AgentSession, CostEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { relative: "—", absolute: iso };
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  let relative = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (mins < 1) relative = "just now";
  else if (mins < 60) relative = `${mins}m ago`;
  else if (mins < 48 * 60) relative = `${Math.round(mins / 60)}h ago`;
  return { relative, absolute: d.toLocaleString() };
}

function shortModel(model: string) {
  const parts = model.split("/");
  return parts[parts.length - 1] || model;
}

export function OperatorOperationsPanel({
  costs,
  sessions,
  busyId,
  refreshKey,
  onDelete,
  onChanged,
  onClearAllCosts,
  onClearAllSessions,
}: {
  costs: CostEntry[];
  sessions: AgentSession[];
  busyId: string | null;
  refreshKey: number;
  onDelete: (collection: "costs" | "agent-sessions", id: string, label: string) => void;
  onChanged: () => void;
  onClearAllCosts?: () => void;
  onClearAllSessions?: () => void;
}) {
  const layout = useOperatorLayout("operations", OPERATIONS_LAYOUT);
  const periodKey = new Date().toISOString().slice(0, 7);
  const periodCosts = costs.filter((c) => c.at.startsWith(periodKey));
  const totalUsd = costs.reduce((sum, c) => sum + c.costUsd, 0);
  const periodUsd = periodCosts.reduce((sum, c) => sum + c.costUsd, 0);
  const premiumUsd = periodCosts
    .filter((c) => c.premium)
    .reduce((sum, c) => sum + c.costUsd, 0);
  const costTime = useCallback((c: CostEntry) => c.at, []);
  const sessionTime = useCallback((s: AgentSession) => s.startedAt, []);

  const ledger = (
    <div className="op-ledger">
      <div className="op-ledger-summary" aria-label="Ledger summary">
        <span className="op-ledger-stat">
          <Coins className="h-3.5 w-3.5" aria-hidden />
          <b>${periodUsd.toFixed(4)}</b>
          <span>period</span>
        </span>
        <span className="op-ledger-stat is-muted">
          <b>${totalUsd.toFixed(4)}</b>
          <span>retained</span>
        </span>
        {premiumUsd > 0 ? (
          <span className="op-ledger-stat is-premium">
            <b>${premiumUsd.toFixed(4)}</b>
            <span>premium</span>
          </span>
        ) : null}
        <span className="op-ledger-stat is-muted">
          <b>{costs.length}</b>
          <span>entries</span>
        </span>
        {onClearAllCosts ? (
          <Tooltip content="Wipe Supabase cost_ledger + period usage (live to all operators)">
            <button
              type="button"
              className="font-mono text-[10px] uppercase tracking-wider text-coral hover:text-foam ml-auto"
              onClick={onClearAllCosts}
            >
              Clear ledger
            </button>
          </Tooltip>
        ) : null}
      </div>

      <CompactFeed
        items={costs}
        getKey={(c) => c.id}
        getTime={costTime}
        label="entries"
        empty={
          <OperatorEmptyState
            icon={Coins}
            title="No cost entries yet"
            description="Rows appear when live sessions consume tokens."
          />
        }
        renderItem={(c) => {
          const when = formatWhen(c.at);
          return (
            <li
              key={c.id}
              className={cn("op-ledger-card", c.premium && "is-premium")}
              role="listitem"
            >
              <div className="op-ledger-card-main">
                <div className="op-ledger-card-top">
                  <p className="op-ledger-label" title={c.label}>
                    {c.label}
                  </p>
                  {c.premium ? (
                    <span className="op-ledger-premium-pill">Premium</span>
                  ) : null}
                  {c.costSource === "openrouter" ? (
                    <span className="op-ledger-billed-pill">Billed</span>
                  ) : c.costSource === "estimate" ? (
                    <span className="op-ledger-est-pill">Est.</span>
                  ) : c.costSource === "mixed" ? (
                    <span className="op-ledger-est-pill">Mixed</span>
                  ) : null}
                </div>
                <div className="op-ledger-meta">
                  <Tooltip content={when.absolute} side="top">
                    <time dateTime={c.at}>{when.relative}</time>
                  </Tooltip>
                  <span className="op-src-dot" aria-hidden />
                  <span className="op-ledger-model" title={c.model}>
                    {shortModel(c.model)}
                  </span>
                  {c.channel ? (
                    <>
                      <span className="op-src-dot" aria-hidden />
                      <span>{c.channel}</span>
                    </>
                  ) : null}
                  {c.tokens > 0 ? (
                    <>
                      <span className="op-src-dot" aria-hidden />
                      <span>{c.tokens.toLocaleString()} tok</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="op-ledger-card-side">
                <span className="op-ledger-amount">${c.costUsd.toFixed(4)}</span>
                <Tooltip content="Delete ledger row" side="top">
                  <button
                    type="button"
                    className="op-icon-btn is-danger"
                    disabled={busyId === c.id}
                    aria-label={`Delete ${c.label}`}
                    onClick={() => void onDelete("costs", c.id, "cost entry")}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </Tooltip>
              </div>
            </li>
          );
        }}
      />
    </div>
  );

  const sessionList = (
    <div className="op-ledger">
      {onClearAllSessions ? (
        <div className="mb-2 flex justify-end">
          <Tooltip content="Delete every agent session from Supabase + memory">
            <button
              type="button"
              className="font-mono text-[10px] uppercase tracking-wider text-coral hover:text-foam"
              onClick={onClearAllSessions}
            >
              Clear all sessions
            </button>
          </Tooltip>
        </div>
      ) : null}
      <CompactFeed
        items={sessions}
        getKey={(s) => s.id}
        getTime={sessionTime}
        label="sessions"
        empty={
          <OperatorEmptyState
            icon={Bot}
            title="No agent sessions"
            description="Run a question from a project to populate this log."
            action={
              <Link href="/dashboard/projects">
                <Button size="sm">Open projects</Button>
              </Link>
            }
          />
        }
        renderItem={(s) => {
          const when = formatWhen(s.startedAt);
          return (
            <li
              key={s.id}
              className={cn(
                "op-ledger-card",
                s.status === "failed" && "is-bad",
                s.status === "completed" && "is-ok",
                (s.status === "running" || s.status === "pending") && "is-live"
              )}
              role="listitem"
            >
              <div className="op-ledger-card-main">
                <div className="op-ledger-card-top">
                  <StatusBadge tone={severityTone(s.status)}>{s.status}</StatusBadge>
                  <Tooltip content={when.absolute} side="top">
                    <time className="op-ledger-when" dateTime={s.startedAt}>
                      {when.relative}
                    </time>
                  </Tooltip>
                </div>
                <p className="op-ledger-label" title={s.question}>
                  {s.projectId ? (
                    <Link href={`/dashboard/projects/${s.projectId}`}>{s.question}</Link>
                  ) : (
                    s.question
                  )}
                </p>
                <div className="op-ledger-meta">
                  <span>${s.estimatedCostUsd.toFixed(4)}</span>
                  {s.tokensUsed ? (
                    <>
                      <span className="op-src-dot" aria-hidden />
                      <span>{s.tokensUsed.toLocaleString()} tok</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="op-ledger-card-side">
                <Tooltip content="Delete session" side="top">
                  <button
                    type="button"
                    className="op-icon-btn is-danger"
                    disabled={busyId === s.id}
                    aria-label={`Delete session ${s.id}`}
                    onClick={() => void onDelete("agent-sessions", s.id, "agent session")}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </Tooltip>
              </div>
            </li>
          );
        }}
      />
    </div>
  );

  return (
    <OperatorModularBoard
      {...layout}
      resetLayout={layout.resetLayout}
      renderModule={(id) => {
        if (id === "ledger") {
          return {
            title: "Cost ledger",
            hint: `${costs.length} spend rows · drag to rearrange`,
            node: ledger,
          };
        }
        if (id === "sessions") {
          return {
            title: "Sessions",
            hint: `${sessions.length} pipeline runs · drag to rearrange`,
            node: sessionList,
          };
        }
        if (id === "moderation") {
          return {
            title: "Moderation",
            hint: "Inventory and policy actions · drag to rearrange",
            bodyClassName: "p-0",
            fixedFrame: true,
            node: (
              <div className="op-module-embed">
                <ModerationPanel embedded refreshKey={refreshKey} onChanged={onChanged} />
              </div>
            ),
          };
        }
        return null;
      }}
    />
  );
}

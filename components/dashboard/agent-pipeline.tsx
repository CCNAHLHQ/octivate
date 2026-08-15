"use client";

import { StatusBadge, severityTone } from "@/components/ui/status-badge";
import { AgentRobot } from "@/components/dashboard/agent-robot";
import { useT } from "@/components/i18n/locale-provider";
import type { AgentSession } from "@/lib/types";

export function AgentPipelineProgress({
  session,
  documentCount = 0,
  idleHint,
}: {
  session?: AgentSession | null;
  documentCount?: number;
  idleHint?: string;
}) {
  const t = useT();
  const isDoctrine = !session || session.pipelineMode === "doctrine";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-faint">
            {isDoctrine ? t("ws.pipeline.doctrine") : t("ws.pipeline.demo")}
          </div>
          <div className="mt-0.5 line-clamp-1 text-sm font-bold text-mist">
            {session?.question || t("ws.pipeline.ready")}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge tone={severityTone(session?.status ?? "pending")}>
            {session?.status ?? "standby"}
          </StatusBadge>
          {session?.analysisDepth && (
            <span className="font-mono text-[9px] font-bold uppercase text-faint">
              {session.analysisDepth}
            </span>
          )}
        </div>
      </div>

      <AgentRobot session={session} documentCount={documentCount} idleHint={idleHint} />
    </div>
  );
}

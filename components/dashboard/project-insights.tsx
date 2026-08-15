"use client";

import { Activity } from "lucide-react";
import { useT } from "@/components/i18n/locale-provider";

/**
 * Legacy module shell — pulse metrics now live on the Agent card.
 * Kept so older saved layouts still render something coherent.
 */
export function ProjectInsights() {
  const t = useT();
  return (
    <div className="ws-pulse-moved">
      <Activity className="h-4 w-4" aria-hidden />
      <div>
        <p className="ws-pulse-moved-title">{t("ws.pulse.onAgent")}</p>
        <p className="ws-pulse-moved-body">{t("ws.pulse.onAgentBody")}</p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ProgressBar, Skeleton } from "@/components/ui/progress";
import { DonutChart } from "@/components/ui/charts";
import { useT } from "@/components/i18n/locale-provider";
import { apiFetch } from "@/lib/api-client";
import type { UsageSnapshot } from "@/lib/types";

export default function UsagePage() {
  const t = useT();
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<{ usage: UsageSnapshot }>("/api/usage");
        setUsage(data.usage);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pct = usage ? Math.min(100, (usage.tokensUsed / usage.tokensLimit) * 100) : 0;

  return (
      <div className="mx-auto max-w-[900px] space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("ws.usage.title")}
          </h1>
          <p className="mt-1 text-sm text-mist">
            Tokens, credits, and estimated OpenRouter cost from live agent runs.
          </p>
        </div>
        {loading || !usage ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <Card className="p-6">
              <h2 className="font-mono text-[11px] font-bold uppercase tracking-widest text-faint">
                {t("ws.usage.tokenAllowance")} · {usage.period}
              </h2>
              <div className="mt-4 font-display text-4xl font-bold tracking-tight text-foam">
                {usage.tokensUsed.toLocaleString()}
                <span className="text-xl font-semibold text-mist">
                  {" "}
                  / {usage.tokensLimit.toLocaleString()}
                </span>
              </div>
              <ProgressBar className="mt-5" value={pct} />
              <p className="mt-4 text-sm text-mist">
                {t("ws.usage.estimatedCost")}{" "}
                <span className="font-mono font-bold text-teal">
                  ${usage.estimatedCostUsd.toFixed(2)}
                </span>
              </p>
            </Card>
            <Card className="stat-card-chart p-6">
              <h2 className="mb-3 font-mono text-[11px] font-bold uppercase tracking-widest text-faint">
                {t("ws.usage.activitySplit")}
              </h2>
              <DonutChart
                centerLabel={t("ws.overview.total")}
                segments={[
                  { name: t("ws.overview.briefs"), value: usage.briefsGenerated },
                  { name: t("ws.overview.sessions"), value: usage.sessionsRun },
                ]}
              />
            </Card>
          </div>
        )}
      </div>
  );
}

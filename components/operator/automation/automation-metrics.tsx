"use client";

import { Gauge } from "lucide-react";
import { OperatorModule } from "@/components/operator/operator-module";
import { LazyDonutChart } from "@/components/ui/lazy-charts";
import { formatBytes, formatRate, type AutoSummary } from "./types";

export function AutomationMetrics({
  summary,
  liveBps,
  peakBps,
  movedBytes,
}: {
  summary: AutoSummary | null;
  liveBps: number;
  peakBps: number;
  movedBytes: number;
}) {
  const s = summary;
  const segments = [
    { name: "Held", value: s?.held ?? 0 },
    { name: "Queued", value: s?.queued ?? 0 },
    { name: "Download", value: s?.downloading ?? 0 },
    { name: "Ready", value: s?.downloaded ?? 0 },
    { name: "ASR", value: s?.transcribing ?? 0 },
    { name: "Done", value: s?.done ?? 0 },
    { name: "Failed", value: s?.failed ?? 0 },
  ].filter((x) => x.value > 0);

  const center =
    (s?.done ?? 0) + (s?.failed ?? 0) + (s?.active ?? 0) + (s?.held ?? 0) || (s?.found ?? 0);

  return (
    <OperatorModule
      title="Pipeline metrics"
      hint="Live stage mix · bandwidth from active downloads"
      className="op-auto2-metrics-mod"
    >
      <div className="op-auto2-metrics-grid">
        <div className="op-auto2-donut">
          <LazyDonutChart
            segments={
              segments.length
                ? segments
                : [{ name: "Idle", value: 1 }]
            }
            centerLabel={`${center || 0} jobs`}
          />
        </div>
        <div className="op-auto2-bw">
          <p className="op-auto2-bw-kicker">
            <Gauge className="h-3.5 w-3.5" aria-hidden />
            Live bandwidth
          </p>
          <p className="op-auto2-bw-rate">{formatRate(liveBps)}</p>
          <dl className="op-auto2-bw-stats">
            <div>
              <dt>Peak</dt>
              <dd>{formatRate(peakBps)}</dd>
            </div>
            <div>
              <dt>Moved</dt>
              <dd>{formatBytes(movedBytes)}</dd>
            </div>
            <div>
              <dt>Downloading</dt>
              <dd>{s?.downloading ?? 0}</dd>
            </div>
            <div>
              <dt>Found</dt>
              <dd>{s?.found ?? 0}</dd>
            </div>
          </dl>
        </div>
      </div>
    </OperatorModule>
  );
}

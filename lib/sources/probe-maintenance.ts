import { readProbeConfig } from "@/lib/sources/probe-config";
import { runSourceProbeBatch } from "@/lib/sources/probe";

let lastRunAt = 0;

/**
 * Throttled probe maintenance for /api/health — never throws to caller.
 * Interval comes from probe config (hours); minimum gap 60s between ticks.
 */
export async function runSourceProbeMaintenance(opts?: {
  force?: boolean;
}): Promise<{ skipped?: boolean; checked?: number }> {
  const cfg = await readProbeConfig().catch(() => null);
  if (!cfg?.enabled && !opts?.force) return { skipped: true };

  const now = Date.now();
  const minGapMs = 60_000;
  const intervalMs = Math.max(minGapMs, (cfg?.intervalHours || 6) * 60 * 60 * 1000);
  // Health is hit often — only start a stale batch after the configured interval
  // (with a 60s floor so concurrent health polls cannot stampede).
  if (!opts?.force && lastRunAt > 0 && now - lastRunAt < intervalMs) {
    return { skipped: true };
  }
  if (!opts?.force && now - lastRunAt < minGapMs) {
    return { skipped: true };
  }

  lastRunAt = now;
  try {
    const report = await runSourceProbeBatch({
      mode: "stale",
      force: Boolean(opts?.force),
      config: cfg || undefined,
    });
    return { checked: report.checked, skipped: report.skipped > 0 && report.checked === 0 };
  } catch {
    return { skipped: true };
  }
}

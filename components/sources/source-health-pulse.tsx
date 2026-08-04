"use client";

import { Tooltip } from "@/components/ui/tooltip";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatChecked(iso?: string): string {
  if (!iso) return "Never checked";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "Never checked";
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function sourceHealthTone(
  source: Source
): "healthy" | "degraded" | "down" | "unknown" {
  if (!source.healthCheckedAt) return "unknown";
  return source.health || "unknown";
}

function explainHealthError(code?: string): string | null {
  if (!code) return null;
  switch (code) {
    case "path_not_found":
      return "Site is up — curated path looks stale (checked origin)";
    case "tls":
      return "Reachable with TLS certificate issues";
    case "timeout":
      return "Slow / timed out";
    case "rate_limited":
      return "Rate limited (429)";
    case "ssrf_blocked":
      return "Blocked by safety guard (not a site outage)";
    case "invalid_url":
      return "URL / DNS could not be validated";
    case "no_url":
      return "No retrieval URL set";
    case "dns":
      return "DNS lookup failed";
    case "http_4xx":
      return "HTTP client error";
    case "http_5xx":
      return "HTTP server error";
    case "too_many_redirects":
      return "Too many redirects";
    case "network":
      return "Network error";
    default:
      return code;
  }
}

export function SourceHealthPulse({ source }: { source: Source }) {
  const tone = sourceHealthTone(source);
  const parts = [
    `Last checked ${formatChecked(source.healthCheckedAt)}`,
    source.healthStatusCode != null ? `HTTP ${source.healthStatusCode}` : null,
    source.healthLatencyMs != null ? `${source.healthLatencyMs}ms` : null,
    explainHealthError(source.healthError ? String(source.healthError) : undefined),
    source.healthUrl ? source.healthUrl : null,
  ].filter(Boolean);

  const label =
    tone === "healthy"
      ? "Available"
      : tone === "degraded"
        ? source.healthError === "path_not_found"
          ? "Path stale"
          : source.healthError === "tls"
            ? "TLS warning"
            : "Degraded"
        : tone === "down"
          ? "Unavailable"
          : "Unchecked";

  return (
    <Tooltip content={parts.join(" · ")} side="top" wrap={false}>
      <span
        className={cn("op-src-health", `is-${tone}`)}
        role="img"
        aria-label={`${label}. ${parts.join(". ")}`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="op-src-health-dot" aria-hidden />
      </span>
    </Tooltip>
  );
}

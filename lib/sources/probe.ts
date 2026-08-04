import http from "http";
import https from "https";
import { appendAudit } from "@/lib/protocol/audit";
import { SEED_SOURCES } from "@/lib/mock/seed";
import { assertSafePublicUrl } from "@/lib/security/ssrf";
import { advanceJob, beginJob, endJob, setJobCurrent } from "@/lib/sources/job-progress";
import { readProbeConfig } from "@/lib/sources/probe-config";
import { readCollection, writeCollection } from "@/lib/store/json-store";
import type { Source, SourceHealthErrorCode, SourceProbeConfig } from "@/lib/types";

/**
 * Browser-like UA — many Caribbean/gov CMS stacks reject bare bot HEAD and
 * custom bot UAs with 404/403 while serving GET to normal browsers.
 */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OctivateSourceProbe/1.2 (+https://octivate.io; source-availability; polite)";

const LATENCY_DEGRADED_MS = 5000;
const GET_DRAIN_BYTES = 8192;
const MAX_INSECURE_REDIRECTS = 5;

const insecureHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: false,
});

const domainLastAt = new Map<string, number>();
let probing = false;

export type ProbeResult = {
  health: Source["health"];
  healthCheckedAt: string;
  healthStatusCode?: number;
  healthLatencyMs: number;
  healthError?: SourceHealthErrorCode | string;
  healthUrl?: string;
  lastChecked: string;
};

type ProbeFetchOk = {
  ok: true;
  status: number;
  latencyMs: number;
  finalUrl: string;
  tlsSoft?: boolean;
  pathFallback?: boolean;
};

type ProbeFetchFail = {
  ok: false;
  latencyMs: number;
  error: SourceHealthErrorCode;
  finalUrl?: string;
};

function probeUrl(source: Source): string {
  return (source.primaryRetrievalUrl || source.url || "").trim();
}

function originUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}/`;
  } catch {
    return null;
  }
}

function isDeepPath(raw: string): boolean {
  try {
    const u = new URL(raw);
    const path = u.pathname || "/";
    return path !== "/" && path !== "";
  } catch {
    return false;
  }
}

async function waitDomainGap(hostname: string, gapMs: number) {
  const last = domainLastAt.get(hostname) || 0;
  const wait = gapMs - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  domainLastAt.set(hostname, Date.now());
}

function classifyHttp(
  status: number,
  latencyMs: number,
  prior: Source["health"],
  flags?: { tlsSoft?: boolean; pathFallback?: boolean }
): { health: Source["health"]; error?: SourceHealthErrorCode } {
  if (flags?.tlsSoft) return { health: "degraded", error: "tls" };
  if (flags?.pathFallback && status >= 200 && status < 400) {
    return { health: "degraded", error: "path_not_found" };
  }
  if (status === 429) return { health: "degraded", error: "rate_limited" };
  if (status >= 200 && status < 400) {
    if (latencyMs > LATENCY_DEGRADED_MS) return { health: "degraded" };
    return { health: "healthy" };
  }
  if (status === 401 || status === 403) return { health: "degraded", error: "http_4xx" };
  if (status >= 500) {
    if (prior === "healthy") return { health: "degraded", error: "http_5xx" };
    return { health: "down", error: "http_5xx" };
  }
  // Soft hysteresis: one hard 4xx after a good check is degraded, not Unavailable.
  if (status >= 400) {
    if (prior === "healthy" || prior === "degraded") {
      return { health: "degraded", error: "http_4xx" };
    }
    return { health: "down", error: "http_4xx" };
  }
  return { health: "down", error: "network" };
}

function mapFetchError(err: unknown): SourceHealthErrorCode {
  const parts: string[] = [];
  if (err instanceof Error) {
    parts.push(err.message);
    const cause = err.cause;
    if (cause instanceof Error) {
      parts.push(cause.message);
      const code = (cause as NodeJS.ErrnoException).code;
      if (code) parts.push(code);
    } else if (cause && typeof cause === "object") {
      const c = cause as { code?: string; message?: string };
      if (c.code) parts.push(c.code);
      if (c.message) parts.push(c.message);
    }
  } else {
    parts.push(String(err));
  }
  const lower = parts.join(" ").toLowerCase();
  if (lower.includes("abort") || lower.includes("timeout")) return "timeout";
  if (
    lower.includes("enotfound") ||
    lower.includes("getaddrinfo") ||
    lower.includes("dns") ||
    lower.includes("eai_again")
  ) {
    return "dns";
  }
  if (
    lower.includes("cert") ||
    lower.includes("ssl") ||
    lower.includes("tls") ||
    lower.includes("unable_to_verify") ||
    lower.includes("self_signed") ||
    lower.includes("depth_zero") ||
    lower.includes("err_tls")
  ) {
    return "tls";
  }
  if (lower.includes("redirect")) return "too_many_redirects";
  return "network";
}

async function drainLimited(res: { body?: ReadableStream<Uint8Array> | null }, maxBytes: number) {
  const reader = res.body?.getReader();
  if (!reader) return;
  let n = 0;
  try {
    while (n < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      n += value?.byteLength || 0;
    }
  } catch {
    /* ignore */
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
}

const BASE_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Range: `bytes=0-${GET_DRAIN_BYTES - 1}`,
};

/** Soft TLS probe via Node https — browsers often forgive incomplete chains that fetch rejects. */
function insecureGet(
  url: string,
  timeoutMs: number,
  redirectsLeft = MAX_INSECURE_REDIRECTS
): Promise<{ status: number; finalUrl: string }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let req: http.ClientRequest;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        reject(new Error("Unsupported protocol"));
        return;
      }
      const lib = parsed.protocol === "https:" ? https : http;
      req = lib.request(
        parsed,
        {
          method: "GET",
          headers: BASE_HEADERS,
          agent: parsed.protocol === "https:" ? insecureHttpsAgent : undefined,
          timeout: timeoutMs,
        },
        (res) => {
          const status = res.statusCode || 0;
          const loc = res.headers.location;
          res.resume();
          if (
            loc &&
            redirectsLeft > 0 &&
            status >= 300 &&
            status < 400
          ) {
            try {
              const next = new URL(loc, parsed).toString();
              insecureGet(next, timeoutMs, redirectsLeft - 1).then(resolve, reject);
            } catch (err) {
              reject(err);
            }
            return;
          }
          settled = true;
          resolve({ status, finalUrl: parsed.toString() });
        }
      );
    } catch (err) {
      reject(err);
      return;
    }

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", (err) => {
      if (!settled) reject(err);
    });
    req.end();
  });
}

async function attemptGet(
  url: string,
  timeoutMs: number,
  insecure = false
): Promise<{ status: number; finalUrl: string } | { error: unknown }> {
  if (insecure) {
    try {
      return await insecureGet(url, timeoutMs);
    } catch (error) {
      return { error };
    }
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: BASE_HEADERS,
    });
    await drainLimited(res, GET_DRAIN_BYTES);
    return {
      status: res.status,
      finalUrl: res.url || url,
    };
  } catch (error) {
    return { error };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Availability probe:
 * 1) GET (not HEAD-first — many CMS return false 404 on HEAD)
 * 2) one retry on transient network/timeout
 * 3) TLS soft-retry (insecure) → degraded when host is up with broken chain
 * 4) origin fallback when deep path 404/410 but site root is live
 */
async function fetchProbe(url: string, timeoutMs: number): Promise<ProbeFetchOk | ProbeFetchFail> {
  const started = Date.now();

  async function getWithRetry(target: string): Promise<ProbeFetchOk | ProbeFetchFail> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * attempt));
      const hit = await attemptGet(target, timeoutMs, false);
      if (!("error" in hit)) {
        return {
          ok: true,
          status: hit.status,
          latencyMs: Date.now() - started,
          finalUrl: hit.finalUrl,
        };
      }
      lastErr = hit.error;
      const code = mapFetchError(hit.error);
      if (code !== "timeout" && code !== "network" && code !== "tls") break;
    }

    const softCode = mapFetchError(lastErr);
    if (softCode === "tls") {
      const soft = await attemptGet(target, timeoutMs, true);
      if (!("error" in soft) && soft.status > 0) {
        return {
          ok: true,
          status: soft.status,
          latencyMs: Date.now() - started,
          finalUrl: soft.finalUrl,
          tlsSoft: true,
        };
      }
    }

    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: softCode,
      finalUrl: target,
    };
  }

  const primary = await getWithRetry(url);
  if (!primary.ok) return primary;

  // Deep-link rot is common in curated registries — if the path 404/410s but the
  // site origin is live, do not mark the source Unavailable.
  const pathMissing =
    (primary.status === 404 || primary.status === 410) && isDeepPath(url);
  if (pathMissing) {
    const origin = originUrl(url);
    if (origin && origin !== url && origin !== primary.finalUrl) {
      const root = await getWithRetry(origin);
      if (root.ok && root.status >= 200 && root.status < 400) {
        return {
          ok: true,
          status: root.status,
          latencyMs: Date.now() - started,
          finalUrl: root.finalUrl,
          tlsSoft: root.tlsSoft || primary.tlsSoft,
          pathFallback: true,
        };
      }
    }
  }

  return primary;
}

export async function probeSourceUrl(
  source: Source,
  cfg: SourceProbeConfig
): Promise<ProbeResult> {
  const now = new Date().toISOString();
  const raw = probeUrl(source);
  if (!raw) {
    return {
      health: "down",
      healthCheckedAt: now,
      healthLatencyMs: 0,
      healthError: "no_url",
      lastChecked: now,
    };
  }

  const safe = await assertSafePublicUrl(raw);
  if (!safe.ok) {
    // Uncheckable ≠ site outage — surface as degraded so operators fix URL/SSRF, not chase downtime.
    return {
      health: "degraded",
      healthCheckedAt: now,
      healthLatencyMs: 0,
      healthError: safe.code,
      healthUrl: raw,
      lastChecked: now,
    };
  }

  await waitDomainGap(safe.hostname, cfg.perDomainGapMs);

  const started = Date.now();
  try {
    const hit = await fetchProbe(safe.url.toString(), cfg.timeoutMs);

    if (!hit.ok) {
      return {
        health: hit.error === "tls" || hit.error === "timeout" ? "degraded" : "down",
        healthCheckedAt: now,
        healthLatencyMs: hit.latencyMs,
        healthError: hit.error,
        healthUrl: hit.finalUrl || raw,
        lastChecked: now,
      };
    }

    if (hit.finalUrl && hit.finalUrl !== safe.url.toString()) {
      const finalSafe = await assertSafePublicUrl(hit.finalUrl);
      if (!finalSafe.ok) {
        return {
          health: "degraded",
          healthCheckedAt: now,
          healthLatencyMs: hit.latencyMs,
          healthError: finalSafe.code,
          healthUrl: hit.finalUrl,
          lastChecked: now,
        };
      }
    }

    const classified = classifyHttp(hit.status, hit.latencyMs, source.health, {
      tlsSoft: hit.tlsSoft,
      pathFallback: hit.pathFallback,
    });
    return {
      health: classified.health,
      healthCheckedAt: now,
      healthStatusCode: hit.status,
      healthLatencyMs: hit.latencyMs,
      healthError: classified.error,
      healthUrl: hit.finalUrl || raw,
      lastChecked: now,
    };
  } catch (err) {
    const code = mapFetchError(err);
    return {
      health: code === "tls" || code === "timeout" ? "degraded" : "down",
      healthCheckedAt: now,
      healthLatencyMs: Date.now() - started,
      healthError: code,
      healthUrl: raw,
      lastChecked: now,
    };
  }
}

function isStale(source: Source, staleAfterHours: number): boolean {
  // Only real probe timestamps — import-seeded lastChecked must not suppress checks.
  const at = source.healthCheckedAt;
  if (!at) return true;
  const ts = Date.parse(at);
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts > staleAfterHours * 60 * 60 * 1000;
}

function sortProbeCandidates(sources: Source[]): Source[] {
  return [...sources].sort((a, b) => {
    const score = (s: Source) => {
      let n = 0;
      if (s.watchPriority === "Core") n += 100;
      if (s.retrievalPriority === "High") n += 40;
      if (s.retrievalPriority === "Medium") n += 10;
      if (s.health === "down") n += 80;
      if (s.health === "degraded") n += 40;
      if (!s.healthCheckedAt) n += 120;
      const at = Date.parse(s.healthCheckedAt || "");
      n += Number.isFinite(at) ? (Date.now() - at) / 3_600_000 : 1000;
      return n;
    };
    return score(b) - score(a);
  });
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

export type ProbeBatchReport = {
  checked: number;
  healthy: number;
  degraded: number;
  down: number;
  skipped: number;
};

export async function runSourceProbeBatch(opts: {
  mode: "stale" | "all" | "one";
  sourceId?: string;
  force?: boolean;
  config?: SourceProbeConfig;
}): Promise<ProbeBatchReport> {
  if (probing && !opts.force) {
    return { checked: 0, healthy: 0, degraded: 0, down: 0, skipped: 1 };
  }
  probing = true;
  const cfg = opts.config || (await readProbeConfig());

  try {
    if (!cfg.enabled && opts.mode !== "one" && !opts.force) {
      return { checked: 0, healthy: 0, degraded: 0, down: 0, skipped: 1 };
    }

    let sources = await readCollection<Source>("sources", SEED_SOURCES);
    let targets: Source[] = [];

    if (opts.mode === "one") {
      const one = sources.find((s) => s.id === opts.sourceId);
      if (!one) throw new Error("Source not found");
      targets = [one];
    } else if (opts.mode === "all") {
      targets = sortProbeCandidates(sources).slice(0, Math.max(cfg.batchSize, sources.length));
    } else {
      targets = sortProbeCandidates(sources.filter((s) => isStale(s, cfg.staleAfterHours))).slice(
        0,
        cfg.batchSize
      );
    }

    if (!targets.length) {
      return { checked: 0, healthy: 0, degraded: 0, down: 0, skipped: 0 };
    }

    beginJob("probe", {
      total: targets.length,
      mode: opts.mode,
      label: opts.mode === "all" ? "Checking all sources" : "Checking stale sources",
      current: targets[0]?.title,
    });

    try {
      const results = await mapPool(targets, cfg.concurrency, async (src) => {
        setJobCurrent("probe", src.title);
        const result = await probeSourceUrl(src, cfg);
        advanceJob("probe", {
          ok: result.health !== "down",
          current: src.title,
        });
        return { id: src.id, title: src.title, result };
      });

      const byId = new Map(results.map((r) => [r.id, r]));
      let healthy = 0;
      let degraded = 0;
      let down = 0;

      sources = sources.map((s) => {
        const hit = byId.get(s.id);
        if (!hit) return s;
        const r = hit.result;
        if (r.health === "healthy") healthy += 1;
        else if (r.health === "degraded") degraded += 1;
        else down += 1;
        return { ...s, ...r };
      });

      await writeCollection("sources", sources);

      await appendAudit({
        action: "source_health_batch",
        detail: `Probed ${results.length} source(s) mode=${opts.mode}: ${healthy} healthy, ${degraded} degraded, ${down} down`,
      });

      for (const r of results) {
        if (r.result.health === "down" || r.result.healthError) {
          await appendAudit({
            action:
              r.result.health === "down" ? "source_health_failed" : "source_health_checked",
            detail: `${r.title} (${r.id}) → ${r.result.health}${
              r.result.healthStatusCode ? ` HTTP ${r.result.healthStatusCode}` : ""
            }${r.result.healthError ? ` · ${r.result.healthError}` : ""} · ${r.result.healthLatencyMs}ms`,
          });
        }
      }

      endJob("probe", {
        label: `Checked ${results.length}: ${healthy} up · ${degraded} degraded · ${down} down`,
      });

      return {
        checked: results.length,
        healthy,
        degraded,
        down,
        skipped: 0,
      };
    } catch (err) {
      endJob("probe", {
        error: true,
        label: err instanceof Error ? err.message : "Probe failed",
      });
      throw err;
    }
  } finally {
    probing = false;
  }
}

export function sourceHealthStats(sources: Source[]): {
  healthy: number;
  degraded: number;
  down: number;
  never: number;
  total: number;
} {
  let healthy = 0;
  let degraded = 0;
  let down = 0;
  let never = 0;
  for (const s of sources) {
    if (!s.healthCheckedAt) {
      never += 1;
      continue;
    }
    if (s.health === "healthy") healthy += 1;
    else if (s.health === "degraded") degraded += 1;
    else down += 1;
  }
  return { healthy, degraded, down, never, total: sources.length };
}

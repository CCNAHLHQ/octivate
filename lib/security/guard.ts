import { NextRequest, NextResponse } from "next/server";
import {
  clientIp,
  isMutating,
  requireApiKey,
  requireOperatorKey,
} from "@/lib/security/api-key";
import { rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";

const GET_LIMIT = 120;
const MUTATE_LIMIT = 40;
const PUBLIC_MUTATE_LIMIT = 8;
const SUMMARIZE_LIMIT = 10;
const PIPELINE_LIMIT = 6;
const TOPICS_LIMIT = 12;
const SUPPORT_LIMIT = 20;
/** Operator GETs (incl. progress polls) need headroom above public GET. */
const OPERATOR_GET_LIMIT = 360;
const OPERATOR_MUTATE_LIMIT = 80;
/** Dedicated high-frequency progress bucket. */
const PROGRESS_LIMIT = 240;
const WINDOW_MS = 60_000;

export type GuardOpts = {
  operator?: boolean;
  publicMutation?: boolean;
  summarize?: boolean;
  pipeline?: boolean;
  topics?: boolean;
  support?: boolean;
  /** Live job progress polls — separate soft bucket. */
  progress?: boolean;
};

/**
 * Shared guard for API routes: rate limit + API key on mutations / operator paths.
 * Dedicated buckets: summarize / pipeline / topics / support / progress.
 */
export function guardApi(req: NextRequest, opts?: GuardOpts): NextResponse | null {
  const ip = clientIp(req);
  const mutating = isMutating(req.method);

  let bucket = "pub";
  let limit = GET_LIMIT;
  if (opts?.progress) {
    bucket = "prog";
    limit = PROGRESS_LIMIT;
  } else if (opts?.pipeline) {
    bucket = "pipe";
    limit = PIPELINE_LIMIT;
  } else if (opts?.topics) {
    bucket = "topics";
    limit = TOPICS_LIMIT;
  } else if (opts?.summarize) {
    bucket = "sum";
    limit = SUMMARIZE_LIMIT;
  } else if (opts?.support) {
    bucket = "support";
    limit = SUPPORT_LIMIT;
  } else if (opts?.operator) {
    if (mutating) {
      bucket = "opm";
      limit = OPERATOR_MUTATE_LIMIT;
    } else {
      bucket = "opg";
      limit = OPERATOR_GET_LIMIT;
    }
  } else if (opts?.publicMutation) {
    bucket = "pubm";
    limit = PUBLIC_MUTATE_LIMIT;
  } else if (mutating) {
    bucket = "pub";
    limit = MUTATE_LIMIT;
  }

  const rl = rateLimit(`${ip}:${req.method}:${bucket}`, limit, WINDOW_MS);

  if (!rl.allowed) {
    const retrySec = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too Many Requests" },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(rl, limit),
          "Retry-After": String(retrySec),
        },
      }
    );
  }

  const path = req.nextUrl?.pathname || "";
  const needsOperator = opts?.operator || path.includes("/operator/");
  const needsKey = !opts?.publicMutation && (mutating || needsOperator);

  if (needsKey) {
    const denied = needsOperator ? requireOperatorKey(req) : requireApiKey(req);
    if (denied) {
      Object.entries(rateLimitHeaders(rl, limit)).forEach(([k, v]) =>
        denied.headers.set(k, String(v))
      );
      return denied;
    }
  }

  return null;
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Short private cache for idempotent GETs — speeds repeat navigations. */
export function jsonCached<T>(data: T, maxAgeSeconds = 10) {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 3}`,
    },
  });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

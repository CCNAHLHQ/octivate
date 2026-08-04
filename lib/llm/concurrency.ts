/**
 * OpenRouter-aware concurrency + retry helpers.
 * Official guidance: honor Retry-After on 429/503; backoff; limit concurrent calls.
 * @see https://openrouter.ai/docs/api/reference/limits
 * @see https://openrouter.ai/docs/api/reference/errors-and-debugging
 */

import { getCachedModelConfig } from "@/lib/openrouter/model-config-store";

type QueueItem = {
  run: () => Promise<unknown>;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
};

let active = 0;
const queue: QueueItem[] = [];

function maxConcurrent(): number {
  return getCachedModelConfig().maxConcurrent || Number(process.env.OPENROUTER_MAX_CONCURRENT) || 3;
}

function pump() {
  while (active < maxConcurrent() && queue.length) {
    const item = queue.shift()!;
    active += 1;
    item
      .run()
      .then(item.resolve, item.reject)
      .finally(() => {
        active -= 1;
        pump();
      });
  }
}

/** Serialize OpenRouter work through a process-wide semaphore. */
export function withLlmSlot<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({
      run: () => fn(),
      resolve: (v) => resolve(v as T),
      reject,
    });
    pump();
  });
}

export async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export type RetryOpts = {
  maxAttempts?: number;
  baseDelayMs?: number;
};

/**
 * Retry wrapper for transient OpenRouter failures (429/503).
 * Honors Retry-After when provided by the caller.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOpts & { getRetryAfterMs?: (err: unknown) => number | null } = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const base = opts.baseDelayMs ?? 1000;
  let last: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable =
        /429|503|rate limit|timed out|timeout|ECONNRESET|fetch failed|empty response/i.test(
          msg
        ) || (err instanceof Error && err.name === "EmptyResponseError");
      if (!retryable || attempt === maxAttempts - 1) throw err;
      const hinted = opts.getRetryAfterMs?.(err);
      const delay = hinted && hinted > 0 ? hinted : base * Math.pow(2, attempt);
      await sleep(Math.min(delay, 30_000));
    }
  }
  throw last instanceof Error ? last : new Error("Retry failed");
}

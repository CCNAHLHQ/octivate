/**
 * Lightweight client API helper with GET dedupe + short TTL cache.
 * Cuts repeat dashboard navigations that re-hit the same endpoints.
 */

const API_KEY =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_OCTIVATE_API_KEY ||
      process.env.OCTIVATE_API_KEY ||
      "octivate-dev-key"
    : "octivate-dev-key";

export function getClientApiKey(): string {
  return API_KEY;
}

const GET_TTL_MS = 15_000;
const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export class ApiError extends Error {
  status: number;
  retryAfterSec?: number;

  constructor(message: string, status: number, retryAfterSec?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

function cacheKey(path: string, method: string) {
  return `${method}:${path}`;
}

export function invalidateApiCache(pathPrefix?: string) {
  if (!pathPrefix) {
    cache.clear();
    return;
  }
  Array.from(cache.keys()).forEach((key) => {
    if (key.includes(pathPrefix)) cache.delete(key);
  });
}

function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get("Retry-After");
  if (!raw) return undefined;
  const sec = Number(raw);
  if (Number.isFinite(sec) && sec >= 0) return Math.ceil(sec);
  const when = Date.parse(raw);
  if (!Number.isNaN(when)) {
    return Math.max(0, Math.ceil((when - Date.now()) / 1000));
  }
  return undefined;
}

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown; cacheTtlMs?: number; skipCache?: boolean }
): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const isGet = method === "GET" && init?.json === undefined;
  const ttl = init?.cacheTtlMs ?? GET_TTL_MS;
  const key = cacheKey(path, method);

  if (isGet && !init?.skipCache) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttl) {
      return hit.data as T;
    }
    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;
  }

  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${API_KEY}`);
  }

  const run = (async () => {
    const res = await fetch(path, {
      ...init,
      method,
      headers,
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
      credentials: "include",
      // Never HTTP-cache operator/live accounting — force-cache made clears look sticky.
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (
        res.status === 401 &&
        typeof window !== "undefined" &&
        (window.location.pathname.startsWith("/dashboard") ||
          window.location.pathname === "/operator")
      ) {
        invalidateApiCache();
        void fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }).finally(() => {
          const next = encodeURIComponent(window.location.pathname);
          window.location.replace(
            `/signin?next=${next}&reason=session_expired`
          );
        });
      }
      const message =
        (data as { error?: string }).error || `Request failed (${res.status})`;
      throw new ApiError(message, res.status, parseRetryAfter(res));
    }

    if (isGet && !init?.skipCache) {
      cache.set(key, { at: Date.now(), data });
    } else if (!isGet) {
      invalidateApiCache("/api/");
    }

    return data as T;
  })();

  if (isGet && !init?.skipCache) {
    inflight.set(key, run);
    try {
      return (await run) as T;
    } finally {
      inflight.delete(key);
    }
  }

  return run;
}

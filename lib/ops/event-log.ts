import { readCollection, writeCollection, uid } from "@/lib/store/json-store";

export type OpsEventLevel = "debug" | "info" | "warn" | "error";
export type OpsEventSource =
  | "openrouter"
  | "pipeline"
  | "audit"
  | "support"
  | "system"
  | "security"
  | "mail";

export type OpsEvent = {
  id: string;
  at: string;
  level: OpsEventLevel;
  source: OpsEventSource;
  message: string;
  meta?: Record<string, unknown>;
};

const STORE = "ops-events";
const MEMORY_CAP = 500;
const DISK_CAP = 1000;

const memory: OpsEvent[] = [];
const listeners = new Set<(evt: OpsEvent) => void>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function redactMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    const key = k.toLowerCase();
    if (
      key.includes("authorization") ||
      key.includes("api_key") ||
      key.includes("apikey") ||
      key.includes("bearer") ||
      key.includes("password") ||
      key.includes("secret")
    ) {
      next[k] = "[redacted]";
      continue;
    }
    if (typeof v === "string" && /sk-[a-zA-Z0-9]|Bearer\s+\S+/i.test(v)) {
      next[k] = "[redacted]";
      continue;
    }
    next[k] = v;
  }
  return next;
}

async function hydrate() {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const disk = await readCollection<OpsEvent>(STORE, []);
        if (memory.length === 0 && disk.length) {
          memory.push(...disk.slice(0, MEMORY_CAP));
        }
      } catch {
        /* ignore */
      } finally {
        hydrated = true;
      }
    })();
  }
  await hydratePromise;
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void writeCollection(STORE, memory.slice(0, DISK_CAP)).catch(() => {
      /* ignore quota */
    });
  }, 250);
}

export async function emitOpsEvent(input: {
  level?: OpsEventLevel;
  source: OpsEventSource;
  message: string;
  meta?: Record<string, unknown>;
}): Promise<OpsEvent> {
  await hydrate();
  const evt: OpsEvent = {
    id: uid("ops"),
    at: new Date().toISOString(),
    level: input.level || "info",
    source: input.source,
    message: String(input.message).slice(0, 2000),
    meta: redactMeta(input.meta),
  };
  memory.unshift(evt);
  if (memory.length > MEMORY_CAP) memory.length = MEMORY_CAP;
  schedulePersist();
  listeners.forEach((fn) => {
    try {
      fn(evt);
    } catch {
      /* ignore listener errors */
    }
  });
  return evt;
}

export async function listOpsEvents(opts?: {
  source?: OpsEventSource;
  level?: OpsEventLevel;
  limit?: number;
  before?: string;
}): Promise<OpsEvent[]> {
  await hydrate();
  let rows = memory.slice();
  if (opts?.source) rows = rows.filter((e) => e.source === opts.source);
  if (opts?.level) rows = rows.filter((e) => e.level === opts.level);
  if (opts?.before) {
    const t = Date.parse(opts.before);
    if (!Number.isNaN(t)) rows = rows.filter((e) => Date.parse(e.at) < t);
  }
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
  return rows.slice(0, limit);
}

export async function clearOpsEvents(): Promise<number> {
  await hydrate();
  const n = memory.length;
  memory.length = 0;
  await writeCollection(STORE, []);
  return n;
}

export function subscribeOpsEvents(fn: (evt: OpsEvent) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

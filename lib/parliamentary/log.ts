import fs from "fs";
import path from "path";
import { emitOpsEvent, type OpsEventLevel } from "@/lib/ops/event-log";

const LOG_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "logs");
const TEXT_LOG = path.join(LOG_DIR, "parl-media.log");
/** Structured cross-process event stream (worker writes, Next API reads). */
const JSONL_LOG = path.join(LOG_DIR, "parl-media-events.jsonl");
const RING_CAP = 500;
const DISK_TAIL_BYTES = 512_000;

export type ParlLogEntry = {
  id: string;
  at: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  meta?: unknown;
  pid?: number;
};

const ring: ParlLogEntry[] = [];
let seq = 0;

function stamp() {
  return new Date().toISOString();
}

function safeJson(v: unknown) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Read newest events from disk (shared by Next + worker). */
export function listParlLog(limit = 120): ParlLogEntry[] {
  const n = Math.max(1, Math.min(RING_CAP, limit));
  const fromDisk = readJsonlTail(n);
  if (fromDisk.length) return fromDisk;

  // Fallback: this process's ring (API-side control actions, etc.)
  return ring.slice(0, n);
}

function readJsonlTail(limit: number): ParlLogEntry[] {
  try {
    if (!fs.existsSync(JSONL_LOG)) return [];
    const st = fs.statSync(JSONL_LOG);
    const start = Math.max(0, st.size - DISK_TAIL_BYTES);
    const fd = fs.openSync(JSONL_LOG, "r");
    try {
      const buf = Buffer.alloc(st.size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      const text = buf.toString("utf8");
      const lines = text.split(/\r?\n/).filter(Boolean);
      const out: ParlLogEntry[] = [];
      for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
        try {
          const row = JSON.parse(lines[i]) as ParlLogEntry;
          if (row?.id && row?.message) out.push(row);
        } catch {
          /* skip corrupt */
        }
      }
      return out;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return [];
  }
}

function maybeRotateJsonl() {
  try {
    if (!fs.existsSync(JSONL_LOG)) return;
    const st = fs.statSync(JSONL_LOG);
    if (st.size < 8_000_000) return;
    const keep = readJsonlTail(RING_CAP);
    const body = `${keep
      .slice()
      .reverse()
      .map((e) => JSON.stringify(e))
      .join("\n")}\n`;
    fs.writeFileSync(JSONL_LOG, body, "utf8");
  } catch {
    /* ignore */
  }
}

function appendJsonl(entry: ParlLogEntry) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    if (seq % 40 === 0) maybeRotateJsonl();
    fs.appendFileSync(JSONL_LOG, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    /* ignore */
  }
}

export function parlLog(
  level: "info" | "warn" | "error" | "debug",
  msg: string,
  extra?: unknown
) {
  const at = stamp();
  const entry: ParlLogEntry = {
    id: `parllog_${process.pid}_${++seq}_${Date.now().toString(36)}`,
    at,
    level,
    message: msg,
    meta: extra,
    pid: process.pid,
  };
  ring.unshift(entry);
  if (ring.length > RING_CAP) ring.length = RING_CAP;
  appendJsonl(entry);

  const line =
    extra === undefined
      ? `[${at}] [${level}] ${msg}`
      : `[${at}] [${level}] ${msg} ${safeJson(extra)}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(TEXT_LOG, `${line}\n`, "utf8");
  } catch {
    /* ignore */
  }

  const opsLevel: OpsEventLevel =
    level === "debug" ? "debug" : level === "warn" ? "warn" : level === "error" ? "error" : "info";
  void emitOpsEvent({
    level: opsLevel,
    source: "pipeline",
    message: `[automation] ${msg}`,
    meta:
      extra && typeof extra === "object"
        ? { ...(extra as Record<string, unknown>), pid: process.pid }
        : { detail: extra, pid: process.pid, channel: "parliamentary-media" },
  }).catch(() => undefined);
}

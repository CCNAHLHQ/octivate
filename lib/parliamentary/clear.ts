import { spawn, spawnSync } from "child_process";
import {
  promises as fs,
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  mkdirSync,
} from "fs";
import path from "path";
import { parlDryRun } from "@/lib/parliamentary/config";
import { parlLog } from "@/lib/parliamentary/log";
import { mediaIndexDir, mediaRoot } from "@/lib/parliamentary/paths";
import {
  resetVerifiedSources,
  setPipelineControl,
  writeCandidates,
  writeJobs,
  writeProgress,
} from "@/lib/parliamentary/store";

const ROOT = /* turbopackIgnore: true */ process.cwd();
const LOG_DIR = path.join(ROOT, "logs");
const PID_FILE = path.join(LOG_DIR, "parl-media.pid");

export type ClearResult = {
  killedPid: number | null;
  wiped: string[];
  workerRestarted: boolean;
  workerPid: number | null;
  dryRun: boolean;
};

async function rmrf(target: string) {
  await fs.rm(target, { recursive: true, force: true }).catch(() => undefined);
}

async function truncateFile(file: string) {
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, "", "utf8");
  } catch {
    /* ignore */
  }
}

function killPidTree(pid: number) {
  if (!Number.isFinite(pid) || pid <= 0) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/F", "/T"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* ignore */
      }
    }
  }
}

async function stopParlWorker(): Promise<number | null> {
  let pid: number | null = null;
  try {
    pid = Number((await fs.readFile(PID_FILE, "utf8")).trim());
  } catch {
    pid = null;
  }
  if (pid && Number.isFinite(pid)) {
    parlLog("warn", "clear: killing parl-media worker tree", { pid });
    killPidTree(pid);
  }
  await fs.unlink(PID_FILE).catch(() => undefined);
  return pid && Number.isFinite(pid) ? pid : null;
}

function envFileValue(key: string): string | undefined {
  try {
    const text = readFileSync(path.join(ROOT, ".env"), "utf8");
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      if (line.slice(0, eq).trim() !== key) continue;
      let v = line.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      return v;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function startParlWorker(): number | null {
  const enabled =
    String(envFileValue("PARL_MEDIA_ENABLED") ?? process.env.PARL_MEDIA_ENABLED ?? "true").toLowerCase() !==
    "false";
  if (!enabled) return null;

  const dry = envFileValue("PARL_MEDIA_DRY_RUN") ?? "0";
  const node = process.execPath;
  const outLog = path.join(LOG_DIR, "parl-media.out.log");
  const errLog = path.join(LOG_DIR, "parl-media.err.log");
  mkdirSync(LOG_DIR, { recursive: true });
  const outFd = openSync(outLog, "w");
  const errFd = openSync(errLog, "w");
  const child = spawn(
    node,
    [
      "--env-file=.env",
      "--experimental-strip-types",
      "--import",
      "./server/parl-ts-register.mjs",
      "server/parl-media-worker.mjs",
    ],
    {
      cwd: ROOT,
      detached: true,
      stdio: ["ignore", outFd, errFd],
      windowsHide: true,
      env: { ...process.env, PARL_MEDIA_DRY_RUN: dry },
    }
  );
  child.unref();
  closeSync(outFd);
  closeSync(errFd);
  if (child.pid) {
    writeFileSync(PID_FILE, String(child.pid), "utf8");
  }
  return child.pid ?? null;
}

/**
 * Hard reset: stop worker tree, delete video artifacts + queue state, restart idle worker.
 * Restores verified sources so operators can Start again immediately.
 */
export async function clearAutomationWorkspace(): Promise<ClearResult> {
  const wiped: string[] = [];
  parlLog("warn", "clear: starting hard reset", { dryRunEnv: parlDryRun() });

  await setPipelineControl("idle", {
    discoverDone: false,
    lastError: undefined,
  }).catch(() => undefined);

  const killedPid = await stopParlWorker();
  // Brief pause so Windows releases file locks on video folders / JSON.
  await new Promise((r) => setTimeout(r, 600));

  const videos = mediaRoot();
  const index = mediaIndexDir();
  await rmrf(videos);
  wiped.push(videos);
  await rmrf(path.join(index, "thumbs"));
  wiped.push(path.join(index, "thumbs"));

  await fs.mkdir(index, { recursive: true });
  await writeJobs([]);
  await writeCandidates([]);
  await writeProgress({
    stage: "idle",
    total: 0,
    done: 0,
    failed: 0,
    message: "Cleared",
  });
  await fs.unlink(path.join(index, "heartbeat.json")).catch(() => undefined);
  await setPipelineControl("idle", { discoverDone: false, lastError: undefined });
  await resetVerifiedSources();
  // Keep settings.json (batch size / ASR provider) across clears.
  wiped.push(path.join(index, "jobs.json"));
  wiped.push(path.join(index, "candidates.json"));

  for (const name of [
    "parl-media.log",
    "parl-media-events.jsonl",
    "parl-media.out.log",
    "parl-media.err.log",
  ]) {
    const file = path.join(LOG_DIR, name);
    await truncateFile(file);
    wiped.push(file);
  }

  const workerPid = startParlWorker();
  parlLog("info", "clear: complete", {
    killedPid,
    workerPid,
    wipedCount: wiped.length,
  });

  return {
    killedPid,
    wiped,
    workerRestarted: workerPid != null,
    workerPid,
    dryRun: parlDryRun(),
  };
}

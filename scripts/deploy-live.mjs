#!/usr/bin/env node
/**
 * Live deploy pipeline for the Windows origin host:
 *   1) next build
 *   2) restart Next + TLS edge (+ mail ports if bound)
 *   3) health check
 *   4) commit safe workspace changes + git push to origin
 *
 * Usage:
 *   npm run deploy:live
 *   npm run deploy:live -- --message "Ship billing UI polish"
 *   npm run deploy:live -- --skip-git
 *   npm run deploy:live -- --skip-restart
 *   npm run deploy:live -- --skip-build
 *   npm run deploy:live -- --dry-run
 *
 * Git push auth (first match):
 *   OCTIVATE_GIT_TOKEN | GITHUB_TOKEN | GH_TOKEN
 * or the existing git credential helper / remote URL.
 */
import { spawnSync, execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const skipBuild = args.has("--skip-build");
const skipRestart = args.has("--skip-restart");
const skipGit = args.has("--skip-git");
const messageArg = (() => {
  const i = process.argv.indexOf("--message");
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith("--message="));
  return eq ? eq.slice("--message=".length) : "";
})();

const NEXT_PORT = Number(process.env.NEXT_PORT || 4000);
const HEALTH_HOST = process.env.DEPLOY_HEALTH_URL || "https://octivate.io/api/health";
const BRANCH = process.env.DEPLOY_GIT_BRANCH || "";
const GIT_NAME = process.env.DEPLOY_GIT_NAME || "CCNAHLHQ";
const GIT_EMAIL =
  process.env.DEPLOY_GIT_EMAIL || "CCNAHLHQ@users.noreply.github.com";

const SECRET_BASENAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  "founder-credentials.local.json",
]);

const SECRET_GLOBS = [
  /^\.env\./i,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /\.p12$/i,
  /^data[\\/]local[\\/]/i,
  /^certs[\\/].+\.(pem|key|json)$/i,
  /^\.next[\\/]/i,
  /^node_modules[\\/]/i,
  /^logs[\\/]/i,
  /^dist[\\/]/i,
];

function log(step, msg) {
  console.log(`[deploy:${step}] ${msg}`);
}

function fail(step, msg, code = 1) {
  console.error(`[deploy:${step}] ${msg}`);
  process.exit(code);
}

function run(cmd, cmdArgs, opts = {}) {
  const res = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32" && cmd === "npm",
    stdio: opts.capture ? "pipe" : "inherit",
    env: { ...process.env, ...opts.env },
  });
  if (res.status !== 0 && !opts.allowFail) {
    fail(opts.step || "run", `${cmd} ${cmdArgs.join(" ")} failed (exit ${res.status})`);
  }
  return res;
}

function git(argsList, opts = {}) {
  const res = spawnSync("git", argsList, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: opts.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      ...opts.env,
    },
  });
  if (res.status !== 0 && !opts.allowFail) {
    const err = (res.stderr || res.stdout || "").trim();
    fail(opts.step || "git", err || `git ${argsList.join(" ")} failed`);
  }
  return (res.stdout || "").trim();
}

function isSecretPath(rel) {
  const norm = rel.replace(/\\/g, "/");
  const base = path.basename(norm);
  if (SECRET_BASENAMES.has(base)) return true;
  if (base === ".env.example") return false;
  return SECRET_GLOBS.some((re) => re.test(norm));
}

function parseStatusPorcelain() {
  const out = git(["status", "--porcelain"], { capture: true, step: "git" });
  if (!out) return [];
  return out.split(/\r?\n/).filter(Boolean).map((line) => {
    // XY PATH or XY ORIG -> PATH
    const pathPart = line.slice(3);
    const arrow = pathPart.indexOf(" -> ");
    const filePath = arrow >= 0 ? pathPart.slice(arrow + 4) : pathPart;
    return filePath.replace(/^"|"$/g, "");
  });
}

function stopPort(port) {
  if (process.platform !== "win32") {
    run("bash", ["-lc", `fuser -k ${port}/tcp || true`], {
      step: "restart",
      allowFail: true,
    });
    return;
  }
  const listed = spawnSync("netstat", ["-ano"], { encoding: "utf8" });
  const lines = (listed.stdout || "").split(/\r?\n/);
  const pids = new Set();
  for (const line of lines) {
    if (!/LISTENING/i.test(line)) continue;
    if (!new RegExp(`:${port}\\s`).test(line)) continue;
    const m = line.trim().match(/(\d+)\s*$/);
    if (m) pids.add(Number(m[1]));
  }
  for (const pid of pids) {
    if (!pid) continue;
    log("restart", `Stopping PID ${pid} on :${port}`);
    if (!dryRun) {
      spawnSync("taskkill", ["/PID", String(pid), "/F"], { stdio: "ignore" });
    }
  }
}

/** Read a single key from repo `.env` (does not mutate process.env). */
function envFileValue(key) {
  try {
    const text = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
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

function startHidden(command, argList, outLog, errLog, envExtra = {}) {
  if (dryRun) {
    log("restart", `Would start: ${command} ${argList.join(" ")}`);
    return null;
  }
  fs.mkdirSync(path.dirname(outLog), { recursive: true });
  const outFd = fs.openSync(outLog, "w");
  const errFd = fs.openSync(errLog, "w");
  const useShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
  const child = spawn(command, argList, {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", outFd, errFd],
    windowsHide: true,
    shell: useShell,
    // Node --env-file does not override existing process env; force file values when provided.
    env: { ...process.env, ...envExtra },
  });
  child.unref();
  fs.closeSync(outFd);
  fs.closeSync(errFd);
  return child.pid;
}

const PARL_PID_FILE = path.join(ROOT, "logs", "parl-media.pid");

function stopParlWorker() {
  let pid = null;
  try {
    pid = Number(fs.readFileSync(PARL_PID_FILE, "utf8").trim());
  } catch {
    pid = null;
  }
  if (pid) {
    log("restart", `Stopping parl-media worker PID ${pid}`);
    if (!dryRun) {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/PID", String(pid), "/F", "/T"], { stdio: "ignore" });
      } else {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          /* ignore */
        }
      }
    }
  }
  if (!dryRun) {
    try {
      fs.unlinkSync(PARL_PID_FILE);
    } catch {
      /* ignore */
    }
  }
}

async function waitHealth(url, attempts = 12) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        log("health", `${url} → ${body.status || res.status}`);
        return true;
      }
      log("health", `attempt ${i}/${attempts}: HTTP ${res.status}`);
    } catch (err) {
      log("health", `attempt ${i}/${attempts}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

function gitToken() {
  return (
    process.env.OCTIVATE_GIT_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    ""
  ).trim();
}

function pushUrlWithToken(token) {
  const remote = git(["remote", "get-url", "origin"], {
    capture: true,
    step: "git",
  });
  if (remote.startsWith("git@") || remote.startsWith("ssh://")) return null;
  try {
    const u = new URL(remote);
    if (!u.hostname.includes("github.com")) return null;
    u.username = "x-access-token";
    u.password = token;
    return u.toString();
  } catch {
    return null;
  }
}

async function main() {
  process.chdir(ROOT);
  log("init", `root=${ROOT} nextPort=${NEXT_PORT} dryRun=${dryRun}`);

  if (!skipBuild) {
    log("build", "npm run build");
    if (!dryRun) run("npm", ["run", "build"], { step: "build" });
  } else {
    log("build", "skipped");
  }

  if (!skipRestart) {
    const ports = [80, 443, NEXT_PORT, 25, 587];
    for (const p of ports) stopPort(p);
    if (!dryRun) await new Promise((r) => setTimeout(r, 2000));

    const logs = path.join(ROOT, "logs");
    fs.mkdirSync(logs, { recursive: true });
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    const node = process.execPath;

    const nextPid = startHidden(
      npx,
      ["next", "start", "-H", "127.0.0.1", "-p", String(NEXT_PORT)],
      path.join(logs, "next.out.log"),
      path.join(logs, "next.err.log")
    );
    log("restart", `Next pid=${nextPid ?? "dry-run"}`);
    if (!dryRun) await new Promise((r) => setTimeout(r, 4000));

    const edgePid = startHidden(
      node,
      ["--env-file=.env", "server/prod.mjs"],
      path.join(logs, "edge.out.log"),
      path.join(logs, "edge.err.log")
    );
    log("restart", `Edge pid=${edgePid ?? "dry-run"}`);
    if (!dryRun) await new Promise((r) => setTimeout(r, 4000));

    stopParlWorker();
    const parlEnabledFile = envFileValue("PARL_MEDIA_ENABLED");
    const parlEnabled =
      String(parlEnabledFile ?? process.env.PARL_MEDIA_ENABLED ?? "true").toLowerCase() !==
      "false";
    if (parlEnabled) {
      // Force dry-run from .env so a leftover shell PARL_MEDIA_DRY_RUN=1 cannot stick.
      const parlDry = envFileValue("PARL_MEDIA_DRY_RUN") ?? "0";
      const parlPid = startHidden(
        node,
        [
          "--env-file=.env",
          "--experimental-strip-types",
          "--import",
          "./server/parl-ts-register.mjs",
          "server/parl-media-worker.mjs",
        ],
        path.join(logs, "parl-media.out.log"),
        path.join(logs, "parl-media.err.log"),
        { PARL_MEDIA_DRY_RUN: parlDry }
      );
      if (parlPid && !dryRun) {
        fs.writeFileSync(PARL_PID_FILE, String(parlPid), "utf8");
      }
      log(
        "restart",
        `Parl-media worker pid=${parlPid ?? "dry-run"} dryRun=${parlDry}`
      );
    } else {
      log("restart", "Parl-media worker skipped (PARL_MEDIA_ENABLED=false)");
    }

    if (!dryRun) {
      const localOk = await waitHealth(`http://127.0.0.1:${NEXT_PORT}/api/health`, 8);
      if (!localOk) fail("health", `Next on :${NEXT_PORT} did not become healthy`);
      const publicOk = await waitHealth(HEALTH_HOST, 10);
      if (!publicOk) {
        log("health", `Public ${HEALTH_HOST} not ready yet — continuing (Cloudflare lag possible)`);
      }
    }
  } else {
    log("restart", "skipped");
  }

  if (skipGit) {
    log("git", "skipped");
    log("done", "deploy finished (no git)");
    return;
  }

  // Ensure identity for this commit only (no git config write)
  const hasName = git(["config", "user.name"], { capture: true, allowFail: true });
  const hasEmail = git(["config", "user.email"], { capture: true, allowFail: true });
  const commitEnv = {
    ...(hasName ? {} : { GIT_AUTHOR_NAME: GIT_NAME, GIT_COMMITTER_NAME: GIT_NAME }),
    ...(hasEmail
      ? {}
      : { GIT_AUTHOR_EMAIL: GIT_EMAIL, GIT_COMMITTER_EMAIL: GIT_EMAIL }),
  };

  const changed = parseStatusPorcelain();
  const safe = changed.filter((f) => !isSecretPath(f));
  const blocked = changed.filter((f) => isSecretPath(f));
  if (blocked.length) {
    log("git", `excluding secrets/noise: ${blocked.slice(0, 8).join(", ")}${blocked.length > 8 ? "…" : ""}`);
  }

  if (!safe.length) {
    log("git", "no safe changes to commit — checking push state");
  } else {
    log("git", `staging ${safe.length} path(s)`);
    if (!dryRun) {
      for (const f of safe) {
        git(["add", "--", f], { step: "git", env: commitEnv });
      }
      const staged = git(["diff", "--cached", "--name-only"], {
        capture: true,
        step: "git",
      });
      if (!staged) {
        log("git", "nothing staged after filters");
      } else {
        const msg =
          messageArg ||
          `Deploy live: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;
        git(
          [
            "-c",
            `user.name=${GIT_NAME}`,
            "-c",
            `user.email=${GIT_EMAIL}`,
            "commit",
            "-m",
            msg,
          ],
          { step: "git", env: commitEnv }
        );
        log("git", `committed: ${msg}`);
      }
    }
  }

  const branch =
    BRANCH ||
    git(["rev-parse", "--abbrev-ref", "HEAD"], { capture: true, step: "git" });
  const ahead = git(["rev-list", "--count", `origin/${branch}..HEAD`], {
    capture: true,
    allowFail: true,
    step: "git",
  });
  const aheadN = Number(ahead || "0");
  if (!aheadN && !dryRun) {
    // still try push in case upstream missing
    log("git", "branch may already be synced; attempting push anyway");
  }

  if (dryRun) {
    log("git", `Would push HEAD → origin/${branch}`);
    log("done", "dry-run complete");
    return;
  }

  const token = gitToken();
  const authed = token ? pushUrlWithToken(token) : null;
  if (authed) {
    log("git", `pushing to origin/${branch} (token auth)`);
    const res = spawnSync("git", ["push", authed, `HEAD:${branch}`], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    if (res.status !== 0) {
      fail("git", (res.stderr || res.stdout || "git push failed").trim());
    }
  } else {
    log("git", `pushing to origin/${branch}`);
    git(["push", "-u", "origin", `HEAD:${branch}`], { step: "git" });
  }

  const head = git(["rev-parse", "--short", "HEAD"], { capture: true, step: "git" });
  log("done", `live deploy complete @ ${head}`);
}

main().catch((err) => fail("fatal", err?.stack || String(err)));

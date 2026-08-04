/**
 * Production app entry — starts Next and ensures local mail submission is up.
 * Used by: npm start
 */
import { spawn } from "child_process";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const MAIL_AUTO_START = String(process.env.MAIL_AUTO_START || "true").toLowerCase() !== "false";
const MAIL_HOST = process.env.HARAKA_HOST || "127.0.0.1";
const MAIL_PORT = Number(
  process.env.MAIL_SUBMISSION_PORT || process.env.HARAKA_PORT || 587
);
const NEXT_HOST = process.env.NEXT_BIND_HOST || "127.0.0.1";
const NEXT_PORT = Number(process.env.NEXT_PORT || 4000);

function portOpen(host, port, ms = 600) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(ms, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

let mailChild = null;
let mailRestartTimer = null;

function superviseMail() {
  if (!MAIL_AUTO_START) {
    console.log("[octivate] MAIL_AUTO_START=false — skipping mail:smtp");
    return;
  }

  const launch = async () => {
    if (await portOpen(MAIL_HOST, MAIL_PORT)) {
      console.log(`[octivate] mail submission already up on ${MAIL_HOST}:${MAIL_PORT}`);
      return;
    }
    const script = path.join(ROOT, "server", "mail", "local-smtp.mjs");
    console.log(`[octivate] Starting mail:smtp (submission :${MAIL_PORT})…`);
    mailChild = spawn(process.execPath, [script], {
      cwd: ROOT,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    mailChild.on("exit", (code, signal) => {
      mailChild = null;
      console.error(
        `[octivate] mail:smtp exited (code=${code} signal=${signal}); restarting in 2s`
      );
      if (mailRestartTimer) clearTimeout(mailRestartTimer);
      mailRestartTimer = setTimeout(() => {
        void launch();
      }, 2000);
    });
  };

  void launch();
}

superviseMail();

const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
const next = spawn(
  process.execPath,
  [nextBin, "start", "-H", NEXT_HOST, "-p", String(NEXT_PORT)],
  {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  }
);

next.on("exit", (code, signal) => {
  if (mailChild && !mailChild.killed) {
    try {
      mailChild.kill();
    } catch {
      /* ignore */
    }
  }
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

process.on("SIGINT", () => {
  next.kill("SIGINT");
});
process.on("SIGTERM", () => {
  next.kill("SIGTERM");
});

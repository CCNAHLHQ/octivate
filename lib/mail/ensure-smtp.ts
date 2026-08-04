import { spawn } from "child_process";
import net from "net";
import path from "path";

let starting: Promise<boolean> | null = null;

function submissionHostPort(): { host: string; port: number } {
  return {
    host: process.env.HARAKA_HOST || "127.0.0.1",
    port: Number(process.env.HARAKA_PORT || process.env.MAIL_SUBMISSION_PORT || 587),
  };
}

function portOpen(host: string, port: number, ms = 600): Promise<boolean> {
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

/**
 * Ensures the local submission listener (mail:smtp) is accepting connections.
 * Spawns server/mail/local-smtp.mjs once if the configured port is closed.
 */
export async function ensureLocalSmtp(): Promise<boolean> {
  const { host, port } = submissionHostPort();
  if (await portOpen(host, port)) return true;
  if (starting) return starting;

  starting = (async () => {
    const script = path.join(process.cwd(), "server", "mail", "local-smtp.mjs");
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      env: process.env,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();

    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 250));
      if (await portOpen(host, port)) return true;
    }
    return false;
  })().finally(() => {
    starting = null;
  });

  return starting;
}

export function smtpUnavailableHint(errMsg: string): string {
  const { host, port } = submissionHostPort();
  if (/ECONNREFUSED|ETIMEDOUT|ESOCKET/i.test(errMsg)) {
    return (
      `SMTP submitter unavailable at ${host}:${port}. ` +
      `Start it with: npm run mail:smtp (or restart npm run serve:prod).`
    );
  }
  return errMsg;
}

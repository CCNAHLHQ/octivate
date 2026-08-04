/**
 * Production edge — brings up HTTP + HTTPS immediately.
 *
 * On start: ensures SSL PEMs under certs/ (auto self-signed if missing/expired),
 * then listens on HTTP_PORT and PORT (HTTPS).
 * Also supervises local SMTP submission (server/mail/local-smtp.mjs) unless
 * MAIL_AUTO_START=false.
 *
 * FORCE_HTTPS=true  → HTTP 301 → HTTPS
 * SSL_AUTO=false    → do not auto-generate (fail if PEMs missing)
 */
import http from "http";
import https from "https";
import fs from "fs";
import net from "net";
import path from "path";
import { spawn } from "child_process";
import { X509Certificate } from "crypto";
import httpProxy from "http-proxy";
import { ensureTls } from "./ensure-tls.mjs";
import { certPaths } from "./tls-paths.mjs";

const HTTPS_PORT = Number(process.env.PORT || 443);
const HTTP_PORT = Number(process.env.HTTP_PORT || 80);
const NEXT_PORT = Number(process.env.NEXT_PORT || 3000);
const PUBLIC_URL = process.env.NEXT_PUBLIC_APP_URL || "https://octivate.io";
const FORCE_HTTPS = String(process.env.FORCE_HTTPS || "").toLowerCase() === "true";
const SSL_AUTO = String(process.env.SSL_AUTO || "true").toLowerCase() !== "false";
const MAIL_AUTO_START = String(process.env.MAIL_AUTO_START || "true").toLowerCase() !== "false";
const MAIL_SUBMISSION_PORT = Number(
  process.env.MAIL_SUBMISSION_PORT || process.env.HARAKA_PORT || 587
);
const MAIL_HOST = process.env.HARAKA_HOST || "127.0.0.1";

const proxy = httpProxy.createProxyServer({
  target: `http://127.0.0.1:${NEXT_PORT}`,
  xfwd: true,
  ws: true,
});

proxy.on("error", (err, req, res) => {
  console.error("[proxy]", err.message);
  if (!res || res.headersSent || typeof res.writeHead !== "function") return;

  const accept = String(req?.headers?.accept || "");
  const wantsHtml = accept.includes("text/html") || !accept.includes("application/json");
  if (wantsHtml) {
    res.writeHead(503, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": "2",
    });
    res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="2" />
  <title>Octivate · Reconnecting</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070b17;color:#eef2ff;font-family:ui-sans-serif,system-ui,sans-serif}
    .card{max-width:26rem;padding:1.5rem;text-align:center}
    p{margin:.4rem 0 0;opacity:.75;line-height:1.5}
    .kicker{font-size:11px;letter-spacing:.16em;text-transform:uppercase;opacity:.55}
  </style>
</head>
<body>
  <div class="card">
    <div class="kicker">Reconnecting</div>
    <h1 style="margin:.75rem 0 0;font-size:1.5rem">Octivate is coming back online</h1>
    <p>The app server is restarting. This page refreshes automatically.</p>
  </div>
  <script>setTimeout(function(){location.reload()},2000)</script>
</body>
</html>`);
    return;
  }

  res.writeHead(503, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Retry-After": "2",
  });
  res.end(JSON.stringify({ error: "Upstream unavailable", retry: true }));
});

function securityHeaders(res, { https: isHttps }) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (isHttps) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
}

function proxyWeb(req, res, { https: isHttps }) {
  securityHeaders(res, { https: isHttps });
  proxy.web(req, res);
}

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

function superviseMailSmtp() {
  if (!MAIL_AUTO_START) {
    console.log("[octivate] MAIL_AUTO_START=false — not launching mail:smtp");
    return;
  }

  const launch = async () => {
    if (await portOpen(MAIL_HOST, MAIL_SUBMISSION_PORT)) {
      console.log(
        `[octivate] mail submission already up on ${MAIL_HOST}:${MAIL_SUBMISSION_PORT}`
      );
      return;
    }
    const script = path.join(process.cwd(), "server", "mail", "local-smtp.mjs");
    console.log(`[octivate] Starting mail:smtp (submission :${MAIL_SUBMISSION_PORT})…`);
    mailChild = spawn(process.execPath, ["--env-file=.env", script], {
      cwd: process.cwd(),
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

async function main() {
  console.log("[octivate] Starting production edge (HTTP + HTTPS)…");
  superviseMailSmtp();

  let tls;
  try {
    if (SSL_AUTO) {
      tls = await ensureTls();
    } else {
      const { cert: CERT, key: KEY } = certPaths();
      if (!fs.existsSync(CERT) || !fs.existsSync(KEY)) {
        throw new Error(
          `SSL_AUTO=false and PEMs missing.\n  ${CERT}\n  ${KEY}\nRun npm run certs:selfsigned`
        );
      }
      tls = { cert: fs.readFileSync(CERT), key: fs.readFileSync(KEY) };
      const x509 = new X509Certificate(tls.cert);
      console.log(`[octivate] TLS ready: ${x509.subject}`);
    }
  } catch (err) {
    console.error("[octivate] TLS bootstrap failed:", err.message);
    process.exit(1);
  }

  const httpsServer = https.createServer(tls, (req, res) => {
    proxyWeb(req, res, { https: true });
  });

  httpsServer.on("upgrade", (req, socket, head) => {
    proxy.ws(req, socket, head);
  });

  const httpServer = http.createServer((req, res) => {
    if (FORCE_HTTPS) {
      const host = (req.headers.host || "octivate.io").split(":")[0];
      res.writeHead(301, { Location: `https://${host}${req.url || "/"}` });
      res.end();
      return;
    }
    proxyWeb(req, res, { https: false });
  });

  httpServer.on("upgrade", (req, socket, head) => {
    if (FORCE_HTTPS) {
      socket.destroy();
      return;
    }
    proxy.ws(req, socket, head);
  });

  await Promise.all([
    new Promise((resolve, reject) => {
      httpsServer.once("error", reject);
      httpsServer.listen(HTTPS_PORT, "0.0.0.0", resolve);
    }),
    new Promise((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(HTTP_PORT, "0.0.0.0", resolve);
    }),
  ]);

  console.log(`[octivate] HTTPS :${HTTPS_PORT} → 127.0.0.1:${NEXT_PORT}  (SSL on)`);
  if (FORCE_HTTPS) {
    console.log(`[octivate] HTTP  :${HTTP_PORT} → HTTPS redirect`);
  } else {
    console.log(`[octivate] HTTP  :${HTTP_PORT} → 127.0.0.1:${NEXT_PORT}  (open)`);
  }
  console.log(`[octivate] Public: ${PUBLIC_URL}`);
}

main().catch((err) => {
  console.error("[octivate] Fatal:", err);
  process.exit(1);
});

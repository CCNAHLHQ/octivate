/**
 * External SMTP listener for Octivate (SMTP 25 + submission 587).
 * Stores local mailboxes under data/local/mailboxes and attempts MX
 * delivery for non-local recipients so outbound mail can leave the host.
 */
import net from "net";
import dns from "dns/promises";
import { promises as fs } from "fs";
import path from "path";
import { randomBytes, createSign, createHash } from "crypto";

const HOST = process.env.MAIL_BIND_HOST || "0.0.0.0";
const SMTP_PORT = Number(process.env.MAIL_SMTP_PORT || 25);
const SUBMISSION_PORT = Number(
  process.env.MAIL_SUBMISSION_PORT || process.env.HARAKA_PORT || 587
);
const DOMAIN = process.env.MAIL_DOMAIN || "octivate.io";
const DIR = path.join(process.cwd(), "data", "local", "mailboxes");
const DKIM_PRIV = path.join(process.cwd(), "data", "local", "dkim", "octivate.private.pem");
const SELECTOR = process.env.DKIM_SELECTOR || "octivate";
const RELAY_HOST = process.env.SMTP_RELAY_HOST || "";
const RELAY_PORT = Number(process.env.SMTP_RELAY_PORT || 25);
const OUTBOUND_ENABLED = process.env.MAIL_OUTBOUND !== "0";

function uid() {
  return `mail_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

function isLocalAddress(addr) {
  const a = String(addr || "").toLowerCase();
  return a.endsWith(`@${DOMAIN}`) || a.endsWith(`@members.${DOMAIN}`);
}

async function store(msg) {
  await fs.mkdir(DIR, { recursive: true });
  const targets = [...new Set([...(msg.to || []), msg.from].filter(Boolean))];
  for (const addr of targets) {
    const mailbox = String(addr).toLowerCase();
    const file = path.join(DIR, `${mailbox.replace(/[^a-z0-9@._-]/g, "_")}.json`);
    let rows = [];
    try {
      rows = JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      rows = [];
    }
    rows.unshift({ ...msg, mailbox });
    await fs.writeFile(file, JSON.stringify(rows.slice(0, 500), null, 2), "utf8");
  }
}

async function dkimSign(raw) {
  try {
    const priv = await fs.readFile(DKIM_PRIV, "utf8");
    const body = raw.includes("\r\n\r\n") ? raw.split(/\r?\n\r?\n/).slice(1).join("\n") : "";
    const bh = createHash("sha256").update(body).digest("base64");
    const header =
      `v=1; a=rsa-sha256; c=relaxed/relaxed; d=${DOMAIN}; s=${SELECTOR}; ` +
      `h=from:to:subject:date; bh=${bh};`;
    const sign = createSign("RSA-SHA256");
    sign.update(header);
    const b = sign.sign(priv, "base64");
    return `DKIM-Signature: ${header} b=${b}`;
  } catch {
    return null;
  }
}

function readSmtpResponse(socket) {
  return new Promise((resolve, reject) => {
    let buf = "";
    const onData = (chunk) => {
      buf += chunk.toString("utf8");
      if (!/\r?\n$/.test(buf) && !buf.includes("\n")) return;
      const lines = buf.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || "";
      if (/^\d{3}-/.test(last)) return;
      socket.off("data", onData);
      socket.off("error", onError);
      resolve(buf.trim());
    };
    const onError = (err) => {
      socket.off("data", onData);
      socket.off("error", onError);
      reject(err);
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function smtpDeliver({ host, port, from, to, raw }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port, timeout: 20000 });
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      reject(err instanceof Error ? err : new Error(String(err)));
    };
    const ok = (info) => {
      if (settled) return;
      settled = true;
      try {
        socket.end();
      } catch {
        /* ignore */
      }
      resolve(info);
    };

    socket.on("timeout", () => fail(new Error(`SMTP timeout to ${host}:${port}`)));
    socket.on("error", fail);

    (async () => {
      const greet = await readSmtpResponse(socket);
      if (!greet.startsWith("220")) throw new Error(`Bad greeting from ${host}: ${greet}`);
      socket.write(`EHLO mail.${DOMAIN}\r\n`);
      const ehlo = await readSmtpResponse(socket);
      if (!ehlo.startsWith("250")) throw new Error(`EHLO failed at ${host}: ${ehlo}`);
      socket.write(`MAIL FROM:<${from}>\r\n`);
      const mailFrom = await readSmtpResponse(socket);
      if (!mailFrom.startsWith("250")) throw new Error(`MAIL FROM rejected: ${mailFrom}`);
      for (const rcpt of to) {
        socket.write(`RCPT TO:<${rcpt}>\r\n`);
        const rcptRes = await readSmtpResponse(socket);
        if (!rcptRes.startsWith("250") && !rcptRes.startsWith("251")) {
          throw new Error(`RCPT TO ${rcpt} rejected: ${rcptRes}`);
        }
      }
      socket.write("DATA\r\n");
      const dataReady = await readSmtpResponse(socket);
      if (!dataReady.startsWith("354")) throw new Error(`DATA not accepted: ${dataReady}`);
      const payload = raw.replace(/^\./gm, "..").replace(/\r?\n/g, "\r\n");
      socket.write(`${payload}\r\n.\r\n`);
      const done = await readSmtpResponse(socket);
      if (!done.startsWith("250")) throw new Error(`DATA rejected: ${done}`);
      socket.write("QUIT\r\n");
      ok(done);
    })().catch(fail);
  });
}

async function resolveMxHosts(domain) {
  try {
    const mx = await dns.resolveMx(domain);
    return mx.sort((a, b) => a.priority - b.priority).map((row) => row.exchange);
  } catch {
    return [domain];
  }
}

async function relayExternal({ from, to, raw }) {
  if (!OUTBOUND_ENABLED) {
    return { relayed: [], failed: to.map((addr) => ({ addr, error: "MAIL_OUTBOUND=0" })) };
  }
  const external = to.filter((addr) => !isLocalAddress(addr));
  if (!external.length) return { relayed: [], failed: [] };

  const relayed = [];
  const failed = [];

  for (const addr of external) {
    const domain = String(addr).split("@")[1];
    if (!domain) {
      failed.push({ addr, error: "invalid address" });
      continue;
    }
    const hosts = RELAY_HOST ? [RELAY_HOST] : await resolveMxHosts(domain);
    const ports = RELAY_HOST ? [RELAY_PORT] : [25];
    let delivered = false;
    let lastError = "no MX hosts";
    for (const host of hosts) {
      for (const port of ports) {
        try {
          const response = await smtpDeliver({ host, port, from, to: [addr], raw });
          relayed.push({ addr, host, port, response });
          delivered = true;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
        }
      }
      if (delivered) break;
    }
    if (!delivered) failed.push({ addr, error: lastError });
  }

  return { relayed, failed };
}

function createSession(socket) {
  let buf = "";
  let from = "";
  let to = [];
  let dataMode = false;
  let data = "";

  const send = (line) => socket.write(line + "\r\n");
  send(`220 mail.${DOMAIN} ESMTP Octivate ready`);

  socket.on("data", async (chunk) => {
    if (dataMode) {
      data += chunk.toString("utf8");
      if (data.includes("\r\n.\r\n")) {
        dataMode = false;
        const rawBody = data.split("\r\n.\r\n")[0];
        const subjectMatch = rawBody.match(/^Subject:\s*(.+)$/im);
        const dkim = await dkimSign(rawBody);
        const raw = dkim ? `${dkim}\r\n${rawBody}` : rawBody;
        const relay = await relayExternal({ from, to, raw }).catch((err) => ({
          relayed: [],
          failed: to
            .filter((addr) => !isLocalAddress(addr))
            .map((addr) => ({
              addr,
              error: err instanceof Error ? err.message : String(err),
            })),
        }));

        await store({
          id: uid(),
          from,
          to,
          subject: subjectMatch?.[1]?.trim() || "(no subject)",
          text: rawBody,
          dkimHeader: dkim || undefined,
          at: new Date().toISOString(),
          direction: "inbound",
          relay,
        });

        if (relay.failed?.length && !relay.relayed?.length && to.some((a) => !isLocalAddress(a))) {
          console.warn(
            "[octivate-mail] outbound relay failed:",
            relay.failed.map((f) => `${f.addr}: ${f.error}`).join("; ")
          );
          // Still accept locally so the app outbox is consistent; diagnostics surface the gap.
          send("250 OK stored locally; external relay incomplete");
        } else {
          send("250 OK");
        }
        data = "";
        from = "";
        to = [];
      }
      return;
    }

    buf += chunk.toString("utf8");
    while (buf.includes("\r\n")) {
      const idx = buf.indexOf("\r\n");
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const upper = line.toUpperCase();
      if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
        send(`250-mail.${DOMAIN}`);
        send("250-SIZE 35840000");
        send("250-8BITMIME");
        send("250 OK");
      } else if (upper.startsWith("MAIL FROM:")) {
        from = line.slice(10).replace(/[<>]/g, "").trim();
        send("250 OK");
      } else if (upper.startsWith("RCPT TO:")) {
        to.push(line.slice(8).replace(/[<>]/g, "").trim());
        send("250 OK");
      } else if (upper === "DATA") {
        dataMode = true;
        data = "";
        send("354 End data with <CR><LF>.<CR><LF>");
      } else if (upper === "RSET") {
        from = "";
        to = [];
        data = "";
        send("250 OK");
      } else if (upper === "QUIT") {
        send("221 Bye");
        socket.end();
      } else if (upper === "NOOP") {
        send("250 OK");
      } else {
        send("250 OK");
      }
    }
  });

  socket.on("error", () => {
    /* ignore client resets */
  });
}

function listen(port, label) {
  const server = net.createServer((socket) => createSession(socket));
  server.on("error", (err) => {
    console.error(`[octivate-mail] ${label} :${port} failed:`, err.message);
  });
  server.listen(port, HOST, () => {
    console.log(`[octivate-mail] ${label} listening on ${HOST}:${port}`);
  });
  return server;
}

listen(SMTP_PORT, "SMTP");
listen(SUBMISSION_PORT, "submission");

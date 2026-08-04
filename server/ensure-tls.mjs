/**
 * Ensure repo-relative PEMs exist. Used by serve:prod so HTTPS is ready immediately.
 */
import fs from "fs";
import path from "path";
import { X509Certificate } from "crypto";
import selfsigned from "selfsigned";
import { certPaths } from "./tls-paths.mjs";

export async function ensureTls({ force = false, quiet = false } = {}) {
  const { dir, cert: certPath, key: keyPath, domain } = certPaths();
  const log = quiet ? () => {} : (...args) => console.log(...args);

  const haveFiles = fs.existsSync(certPath) && fs.existsSync(keyPath);
  let expired = false;

  if (haveFiles && !force) {
    try {
      const x509 = new X509Certificate(fs.readFileSync(certPath));
      const daysLeft = Math.floor(
        (new Date(x509.validTo).getTime() - Date.now()) / 86_400_000
      );
      if (daysLeft < 0) expired = true;
      else {
        log(`[octivate] TLS ready: ${x509.subject} · ${daysLeft}d left`);
        return {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
          generated: false,
          domain,
          paths: { dir, cert: certPath, key: keyPath },
        };
      }
    } catch {
      /* regenerate below */
    }
  }

  if (haveFiles && expired) {
    log("[octivate] TLS expired — regenerating self-signed…");
  } else if (!haveFiles) {
    log("[octivate] No TLS PEMs — generating self-signed into certs/…");
  } else if (force) {
    log("[octivate] Forcing new self-signed TLS…");
  }

  const days = Number(process.env.SSL_DAYS || 825);
  const notBeforeDate = new Date();
  const notAfterDate = new Date(notBeforeDate);
  notAfterDate.setDate(notAfterDate.getDate() + days);

  const pems = await selfsigned.generate([{ name: "commonName", value: domain }], {
    keySize: 2048,
    algorithm: "sha256",
    notBeforeDate,
    notAfterDate,
    extensions: [
      { name: "basicConstraints", cA: false, critical: true },
      {
        name: "keyUsage",
        critical: true,
        digitalSignature: true,
        keyEncipherment: true,
      },
      { name: "extKeyUsage", serverAuth: true },
      {
        name: "subjectAltName",
        altNames: [
          { type: 2, value: domain },
          { type: 2, value: `www.${domain}` },
          { type: 2, value: "localhost" },
        ],
      },
    ],
  });

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(certPath, pems.cert, { encoding: "utf8", mode: 0o644 });
  fs.writeFileSync(keyPath, pems.private, { encoding: "utf8", mode: 0o600 });
  fs.writeFileSync(
    path.join(dir, "meta.json"),
    JSON.stringify(
      {
        domain,
        type: "self-signed",
        generatedAt: new Date().toISOString(),
        validTo: notAfterDate.toISOString(),
        days,
        relative: `certs/${domain}/`,
        auto: true,
      },
      null,
      2
    ),
    "utf8"
  );

  log(`[octivate] TLS written: ${certPath}`);
  log(`[octivate] TLS valid until ${notAfterDate.toISOString()}`);

  return {
    cert: Buffer.from(pems.cert),
    key: Buffer.from(pems.private),
    generated: true,
    domain,
    paths: { dir, cert: certPath, key: keyPath },
  };
}

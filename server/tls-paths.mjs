/**
 * Server-side TLS paths — always relative to the repo root (`certs/`).
 * Override with SSL_CERT_PATH / SSL_KEY_PATH / SSL_CERT_DIR if needed.
 */
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOMAIN = process.env.SSL_DOMAIN || "octivate.io";

export const REPO_ROOT = ROOT;

export function certDir() {
  if (process.env.SSL_CERT_DIR) {
    return path.isAbsolute(process.env.SSL_CERT_DIR)
      ? process.env.SSL_CERT_DIR
      : path.resolve(ROOT, process.env.SSL_CERT_DIR);
  }
  return path.join(ROOT, "certs", DOMAIN);
}

export function certPaths() {
  const dir = certDir();
  const cert = process.env.SSL_CERT_PATH
    ? path.isAbsolute(process.env.SSL_CERT_PATH)
      ? process.env.SSL_CERT_PATH
      : path.resolve(ROOT, process.env.SSL_CERT_PATH)
    : path.join(dir, "fullchain.pem");
  const key = process.env.SSL_KEY_PATH
    ? path.isAbsolute(process.env.SSL_KEY_PATH)
      ? process.env.SSL_KEY_PATH
      : path.resolve(ROOT, process.env.SSL_KEY_PATH)
    : path.join(dir, "privkey.pem");
  return { dir, cert, key, domain: DOMAIN, root: ROOT };
}

/**
 * Generate DKIM RSA keypair for octivate.io
 * Usage: node scripts/generate-dkim.mjs
 */
import { generateKeyPairSync } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "data", "local", "dkim");
const SELECTOR = process.env.DKIM_SELECTOR || "octivate";
const DOMAIN = process.env.MAIL_DOMAIN || "octivate.io";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

await fs.mkdir(DIR, { recursive: true });
await fs.writeFile(path.join(DIR, "octivate.private.pem"), privateKey, "utf8");
await fs.writeFile(path.join(DIR, "octivate.public.pem"), publicKey, "utf8");

const pubBody = publicKey
  .replace(/-----BEGIN PUBLIC KEY-----/, "")
  .replace(/-----END PUBLIC KEY-----/, "")
  .replace(/\s+/g, "");

const txt = `v=DKIM1; k=rsa; p=${pubBody}`;
const record = {
  selector: SELECTOR,
  domain: DOMAIN,
  name: `${SELECTOR}._domainkey`,
  type: "TXT",
  content: txt,
  publicKeyPem: publicKey,
};

await fs.writeFile(path.join(DIR, "dns-record.json"), JSON.stringify(record, null, 2), "utf8");
console.log(`DKIM selector: ${SELECTOR}._domainkey.${DOMAIN}`);
console.log(`TXT value length: ${txt.length}`);
console.log(`Wrote ${path.join(DIR, "dns-record.json")}`);

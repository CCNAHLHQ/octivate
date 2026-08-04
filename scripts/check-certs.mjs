/**
 * Verify repo-relative TLS PEMs exist and are not expired.
 *
 *   npm run certs:check
 */
import fs from "fs";
import { X509Certificate } from "crypto";
import { certPaths } from "../server/tls-paths.mjs";

const { cert: CERT, key: KEY, dir } = certPaths();

function fail(msg) {
  console.error(`[certs:check] FAIL — ${msg}`);
  process.exit(1);
}

console.log("[certs:check] Looking for TLS material under repo certs/:\n");
console.log(`  DIR:  ${dir}`);
console.log(`  CERT: ${CERT}`);
console.log(`  KEY:  ${KEY}\n`);

if (!fs.existsSync(CERT)) {
  fail(
    `fullchain missing at ${CERT}\n` +
      "  On the server:  npm run certs:selfsigned\n" +
      "  Or Certbot:     npm run certs:sync\n" +
      "  See certs/README.md"
  );
}

if (!fs.existsSync(KEY)) {
  fail(`privkey missing at ${KEY}\n  npm run certs:selfsigned   or   npm run certs:sync`);
}

const certStat = fs.statSync(CERT);
const keyStat = fs.statSync(KEY);

let x509;
try {
  x509 = new X509Certificate(fs.readFileSync(CERT));
} catch (err) {
  fail(`Could not parse certificate: ${err.message}`);
}

const validTo = new Date(x509.validTo);
const validFrom = new Date(x509.validFrom);
const daysLeft = Math.floor((validTo.getTime() - Date.now()) / 86_400_000);

console.log("[certs:check] OK — PEMs present");
console.log(`  Subject:    ${x509.subject}`);
console.log(`  Issuer:     ${x509.issuer}`);
console.log(`  Valid from: ${validFrom.toISOString()}`);
console.log(`  Valid to:   ${validTo.toISOString()}`);
console.log(`  Days left:  ${daysLeft}`);
console.log(`  Cert size:  ${certStat.size} bytes · Key size: ${keyStat.size} bytes`);

if (daysLeft < 0) {
  fail("Certificate is EXPIRED — run npm run certs:selfsigned (or renew Certbot)");
}

if (daysLeft < 14) {
  console.warn(
    `\n[certs:check] WARN — renew soon (${daysLeft} days left).`
  );
}

console.log(
  "\n[certs:check] Reminder: *.pem under certs/ are gitignored — generate on the server after deploy."
);
process.exit(0);

/**
 * Upsert SPF / DKIM / DMARC / MX / mail A record on Cloudflare for octivate.io
 *
 * Requires:
 *   CLOUDFLARE_API_TOKEN  — Zone.DNS Edit on octivate.io
 *   CLOUDFLARE_ZONE_ID    — optional; auto-resolved from zone name
 *
 * Usage: node --env-file=.env scripts/cloudflare-mail-dns.mjs
 */
import { promises as fs } from "fs";
import path from "path";

const DOMAIN = process.env.MAIL_DOMAIN || "octivate.io";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim();
const MAIL_HOST = process.env.MAIL_HOSTNAME || `mail.${DOMAIN}`;
const PUBLIC_IP = process.env.MAIL_PUBLIC_IP || process.env.SERVER_PUBLIC_IP || "";
const SELECTOR = process.env.DKIM_SELECTOR || "octivate";
const API = "https://api.cloudflare.com/client/v4";

if (!TOKEN) {
  console.error(
    "CLOUDFLARE_API_TOKEN is missing.\nCreate a token at https://dash.cloudflare.com/profile/api-tokens with Zone.DNS:Edit for octivate.io, then add it to .env and re-run."
  );
  process.exit(1);
}

async function cf(pathname, init = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(
      `Cloudflare ${res.status}: ${JSON.stringify(data.errors || data)}`
    );
  }
  return data.result;
}

async function resolveZoneId() {
  if (process.env.CLOUDFLARE_ZONE_ID?.trim()) return process.env.CLOUDFLARE_ZONE_ID.trim();
  const zones = await cf(`/zones?name=${encodeURIComponent(DOMAIN)}`);
  if (!zones?.length) throw new Error(`Zone not found for ${DOMAIN}`);
  return zones[0].id;
}

async function upsert(zoneId, record) {
  const list = await cf(
    `/zones/${zoneId}/dns_records?type=${record.type}&name=${encodeURIComponent(record.name)}`
  );
  const existing = (list || []).find((r) => r.name === record.name || r.name === `${record.name}.${DOMAIN}` || r.name.endsWith(record.name));
  // Prefer exact match on name
  const hit =
    (list || []).find((r) => r.name === record.name) ||
    (list || []).find((r) => r.type === record.type && r.name.startsWith(record.name.split(".")[0]));

  const body = {
    type: record.type,
    name: record.name,
    content: record.content,
    ttl: record.ttl || 300,
    proxied: record.proxied === true,
    ...(record.priority != null ? { priority: record.priority } : {}),
  };

  if (hit?.id) {
    const updated = await cf(`/zones/${zoneId}/dns_records/${hit.id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return { action: "updated", id: updated.id, name: updated.name };
  }
  const created = await cf(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { action: "created", id: created.id, name: created.name };
}

async function detectPublicIp() {
  if (PUBLIC_IP) return PUBLIC_IP;
  const res = await fetch("https://api.ipify.org?format=json");
  const data = await res.json();
  return data.ip;
}

async function main() {
  const dkimPath = path.join(process.cwd(), "data", "local", "dkim", "dns-record.json");
  const dkim = JSON.parse(await fs.readFile(dkimPath, "utf8"));
  const ip = await detectPublicIp();
  const zoneId = await resolveZoneId();

  const spf = `v=spf1 ip4:${ip} a:${MAIL_HOST} ~all`;
  const dmarc = `v=DMARC1; p=none; rua=mailto:jaden@${DOMAIN}; fo=1`;

  const records = [
    { type: "A", name: MAIL_HOST, content: ip, proxied: false, ttl: 300 },
    { type: "MX", name: DOMAIN, content: MAIL_HOST, priority: 10, ttl: 300 },
    { type: "TXT", name: DOMAIN, content: spf, ttl: 300 },
    {
      type: "TXT",
      name: `${SELECTOR}._domainkey.${DOMAIN}`,
      content: dkim.content,
      ttl: 300,
    },
    { type: "TXT", name: `_dmarc.${DOMAIN}`, content: dmarc, ttl: 300 },
  ];

  // SPF may collide with an existing TXT on apex — update SPF-looking TXT only
  const results = [];
  for (const rec of records) {
    if (rec.type === "TXT" && rec.name === DOMAIN) {
      const list = await cf(`/zones/${zoneId}/dns_records?type=TXT&name=${encodeURIComponent(DOMAIN)}`);
      const spfHit = (list || []).find((r) => String(r.content).includes("v=spf1"));
      if (spfHit?.id) {
        const updated = await cf(`/zones/${zoneId}/dns_records/${spfHit.id}`, {
          method: "PUT",
          body: JSON.stringify({
            type: "TXT",
            name: DOMAIN,
            content: spf,
            ttl: 300,
          }),
        });
        results.push({ action: "updated", id: updated.id, name: updated.name, kind: "SPF" });
        continue;
      }
    }
    results.push({ ...(await upsert(zoneId, rec)), kind: rec.type });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        domain: DOMAIN,
        mailHost: MAIL_HOST,
        ip,
        zoneId,
        results,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

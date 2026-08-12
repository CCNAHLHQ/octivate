/**
 * Upsert Cloudflare A records for the Octivate origin (@ + www).
 *
 * Requires:
 *   CLOUDFLARE_API_TOKEN  — Zone.DNS Edit on octivate.io
 *   CLOUDFLARE_ZONE_ID    — optional; auto-resolved from zone name
 *   SERVER_PUBLIC_IP      — optional; auto-detected via ipify if unset
 *
 * Usage: node --env-file=.env scripts/cloudflare-origin-dns.mjs
 */
const DOMAIN = process.env.SSL_DOMAIN || process.env.MAIL_DOMAIN || "octivate.io";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim();
const PUBLIC_IP = process.env.SERVER_PUBLIC_IP || process.env.MAIL_PUBLIC_IP || "";
const PROXIED = String(process.env.CLOUDFLARE_PROXY || "true").toLowerCase() !== "false";
const API = "https://api.cloudflare.com/client/v4";

if (!TOKEN) {
  console.error(
    "CLOUDFLARE_API_TOKEN is missing.\nCreate a token at https://dash.cloudflare.com/profile/api-tokens with Zone.DNS:Edit for octivate.io, then add it to .env and re-run:\n  npm run dns:origin"
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
  if (process.env.CLOUDFLARE_ZONE_ID?.trim()) {
    return process.env.CLOUDFLARE_ZONE_ID.trim();
  }
  const zones = await cf(`/zones?name=${encodeURIComponent(DOMAIN)}`);
  if (!zones?.length) throw new Error(`Zone not found for ${DOMAIN}`);
  return zones[0].id;
}

async function detectPublicIp() {
  if (PUBLIC_IP) return PUBLIC_IP.trim();
  const res = await fetch("https://api.ipify.org?format=json");
  const data = await res.json();
  return data.ip;
}

async function upsertA(zoneId, name, ip) {
  // Any record with this name (A/AAAA/CNAME) — Cloudflare forbids mixed types.
  const list = await cf(
    `/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}`
  );
  const cname = (list || []).find((r) => r.type === "CNAME" && r.name === name);
  if (cname) {
    const target = String(cname.content || "").replace(/\.$/, "").toLowerCase();
    const apexOk = target === DOMAIN.toLowerCase() || target === `@`;
    if (apexOk) {
      return {
        action: "kept-cname",
        id: cname.id,
        name: cname.name,
        content: `${cname.content} (follows apex A → ${ip})`,
        proxied: cname.proxied,
      };
    }
    // Replace non-apex CNAME with origin A
    await cf(`/zones/${zoneId}/dns_records/${cname.id}`, { method: "DELETE" });
  }

  const hit = (list || []).find((r) => r.type === "A" && r.name === name);
  const body = {
    type: "A",
    name,
    content: ip,
    ttl: 1,
    proxied: PROXIED,
  };
  if (hit?.id) {
    if (hit.content === ip && Boolean(hit.proxied) === PROXIED) {
      return { action: "unchanged", id: hit.id, name: hit.name, content: ip, proxied: PROXIED };
    }
    const updated = await cf(`/zones/${zoneId}/dns_records/${hit.id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return {
      action: "updated",
      id: updated.id,
      name: updated.name,
      content: updated.content,
      proxied: updated.proxied,
    };
  }
  const created = await cf(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return {
    action: "created",
    id: created.id,
    name: created.name,
    content: created.content,
    proxied: created.proxied,
  };
}

async function main() {
  const ip = await detectPublicIp();
  const zoneId = await resolveZoneId();
  const names = [DOMAIN, `www.${DOMAIN}`];
  console.log(`[dns:origin] zone=${DOMAIN} ip=${ip} proxied=${PROXIED}`);
  for (const name of names) {
    const result = await upsertA(zoneId, name, ip);
    console.log(
      `[dns:origin] ${result.action}: ${result.name} → ${result.content} (proxied=${result.proxied})`
    );
  }
  console.log("[dns:origin] Done. Cloudflare SSL/TLS should be Full (self-signed origin) or Full (strict) after Let's Encrypt.");
}

main().catch((err) => {
  console.error("[dns:origin]", err.message || err);
  process.exit(1);
});

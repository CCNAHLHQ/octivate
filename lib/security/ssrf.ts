import dns from "dns/promises";
import net from "net";

export type SsrfCheckResult =
  | { ok: true; url: URL; hostname: string }
  | { ok: false; code: "invalid_url" | "ssrf_blocked"; detail: string };

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
  "metadata",
]);

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
  if (normalized.startsWith("fe80")) return true; // link-local
  if (normalized.startsWith("::ffff:")) {
    const v4 = normalized.slice("::ffff:".length);
    if (net.isIP(v4) === 4) return isPrivateIpv4(v4);
  }
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const ver = net.isIP(ip);
  if (ver === 4) return isPrivateIpv4(ip);
  if (ver === 6) return isPrivateIpv6(ip);
  return true;
}

/** Validate URL scheme/host and resolve DNS to block private targets (SSRF). */
export async function assertSafePublicUrl(raw: string): Promise<SsrfCheckResult> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, code: "invalid_url", detail: "Malformed URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, code: "ssrf_blocked", detail: `Blocked scheme ${url.protocol}` };
  }
  if (url.username || url.password) {
    return { ok: false, code: "ssrf_blocked", detail: "Credentials in URL are not allowed" };
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname) {
    return { ok: false, code: "invalid_url", detail: "Missing hostname" };
  }
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return { ok: false, code: "ssrf_blocked", detail: `Blocked host ${hostname}` };
  }
  if (hostname === "metadata.google.internal" || hostname.includes("169.254.169.254")) {
    return { ok: false, code: "ssrf_blocked", detail: "Blocked cloud metadata host" };
  }

  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      return { ok: false, code: "ssrf_blocked", detail: `Blocked IP ${hostname}` };
    }
    return { ok: true, url, hostname };
  }

  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!records.length) {
      return { ok: false, code: "invalid_url", detail: "DNS returned no addresses" };
    }
    // Allow when any resolved address is public. Dual-stack hosts often publish a
    // bogus/private AAAA alongside a valid A — blocking on "any private" caused
    // false unavailable results for otherwise reachable sites.
    const publicRecords = records.filter((rec) => !isBlockedIp(rec.address));
    if (!publicRecords.length) {
      return {
        ok: false,
        code: "ssrf_blocked",
        detail: `Host resolves only to blocked addresses (${records
          .map((r) => r.address)
          .join(", ")})`,
      };
    }
  } catch {
    return { ok: false, code: "invalid_url", detail: "DNS lookup failed" };
  }

  return { ok: true, url, hostname };
}

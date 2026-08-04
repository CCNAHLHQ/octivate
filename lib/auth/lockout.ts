import { rateLimit } from "@/lib/security/rate-limit";

/** Stricter login lockout: IP + identity. */
export function loginAllowed(ip: string, identity: string): {
  allowed: boolean;
  retryAfterSec: number;
} {
  const ipHit = rateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000);
  const idHit = rateLimit(`login:id:${identity.toLowerCase()}`, 8, 15 * 60 * 1000);
  if (!ipHit.allowed || !idHit.allowed) {
    const resetAt = Math.max(ipHit.resetAt, idHit.resetAt);
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function registerAllowed(ip: string): {
  allowed: boolean;
  retryAfterSec: number;
} {
  const hit = rateLimit(`register:ip:${ip}`, 6, 60 * 60 * 1000);
  if (!hit.allowed) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((hit.resetAt - Date.now()) / 1000)),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

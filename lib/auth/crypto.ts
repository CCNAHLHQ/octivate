import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const KEYLEN = 64;

export function generatePassword(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}

export function generateUsername(prefix = "user"): string {
  return `${prefix}_${randomBytes(4).toString("hex")}`;
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, KEYLEN, SCRYPT_OPTS).toString("base64url");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  try {
    const derived = scryptSync(password, salt, KEYLEN, SCRYPT_OPTS);
    const expected = Buffer.from(hash, "base64url");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Fast hash for high-entropy opaque session tokens (never store raw tokens). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

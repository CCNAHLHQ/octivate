import { readCollection, writeCollection, uid } from "@/lib/store/json-store";
import { generateToken, hashToken } from "@/lib/auth/crypto";

const COLLECTION = "password-resets";
const TTL_MS = 60 * 60 * 1000; // 1 hour

export type PasswordResetRecord = {
  id: string;
  userId: string;
  email: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
};

export async function createPasswordReset(
  userId: string,
  email: string
): Promise<{ token: string; record: PasswordResetRecord }> {
  const token = generateToken();
  const now = Date.now();
  const record: PasswordResetRecord = {
    id: uid("pwr"),
    userId,
    email: email.toLowerCase(),
    tokenHash: hashToken(token),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString(),
  };
  const rows = await readCollection<PasswordResetRecord>(COLLECTION, []);
  const pruned = rows.filter(
    (r) => !r.usedAt && new Date(r.expiresAt).getTime() > now
  );
  pruned.push(record);
  await writeCollection(COLLECTION, pruned.slice(-200));
  return { token, record };
}

export async function consumePasswordResetToken(
  token: string
): Promise<PasswordResetRecord | null> {
  if (!token || token.length < 16) return null;
  const hash = hashToken(token);
  const now = Date.now();
  const rows = await readCollection<PasswordResetRecord>(COLLECTION, []);
  const idx = rows.findIndex(
    (r) =>
      r.tokenHash === hash &&
      !r.usedAt &&
      new Date(r.expiresAt).getTime() > now
  );
  if (idx < 0) return null;
  rows[idx] = { ...rows[idx], usedAt: new Date().toISOString() };
  await writeCollection(COLLECTION, rows);
  return rows[idx];
}

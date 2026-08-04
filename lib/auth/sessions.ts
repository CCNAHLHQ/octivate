import { readCollection, writeCollection, uid } from "@/lib/store/json-store";
import { generateToken, hashToken } from "@/lib/auth/crypto";
import type { AuthSession } from "@/lib/auth/types";

const COLLECTION = "auth-sessions";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession(userId: string): Promise<{ token: string; session: AuthSession }> {
  const token = generateToken();
  const now = Date.now();
  const session: AuthSession = {
    id: uid("sess"),
    userId,
    tokenHash: hashToken(token),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString(),
  };
  const sessions = await readCollection<AuthSession>(COLLECTION, []);
  const pruned = sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
  pruned.push(session);
  await writeCollection(COLLECTION, pruned);
  return { token, session };
}

export async function resolveSessionToken(token: string): Promise<AuthSession | null> {
  if (!token || token.length < 16) return null;
  const hash = hashToken(token);
  const now = Date.now();
  const sessions = await readCollection<AuthSession>(COLLECTION, []);
  const hit = sessions.find(
    (s) => s.tokenHash === hash && new Date(s.expiresAt).getTime() > now
  );
  return hit ?? null;
}

export async function revokeSessionToken(token: string): Promise<void> {
  const hash = hashToken(token);
  const sessions = await readCollection<AuthSession>(COLLECTION, []);
  await writeCollection(
    COLLECTION,
    sessions.filter((s) => s.tokenHash !== hash)
  );
}

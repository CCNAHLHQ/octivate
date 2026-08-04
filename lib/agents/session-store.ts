import type { AgentSession } from "@/lib/types";
import {
  clearAllAgentSessionRows,
  deleteAgentSessionRow,
  getAgentSessionRow,
  listAgentSessionRows,
  upsertAgentSession,
} from "@/lib/supabase/ops-db";
import { publishAccountingTick } from "@/lib/usage/usage-store";

const sessionsMemory = new Map<string, AgentSession>();
const listeners = new Map<string, Set<(s: AgentSession) => void>>();

export function subscribeSession(id: string, cb: (s: AgentSession) => void): () => void {
  if (!listeners.has(id)) listeners.set(id, new Set());
  listeners.get(id)!.add(cb);
  return () => listeners.get(id)?.delete(cb);
}

export function emitSession(session: AgentSession) {
  sessionsMemory.set(session.id, session);
  listeners.get(session.id)?.forEach((cb) =>
    cb({ ...session, stages: session.stages.map((s) => ({ ...s })) })
  );
}

export async function getSession(id: string): Promise<AgentSession | null> {
  if (sessionsMemory.has(id)) return sessionsMemory.get(id)!;
  const found = await getAgentSessionRow(id);
  if (found) sessionsMemory.set(id, found);
  return found;
}

export async function persistSession(session: AgentSession) {
  session.updatedAt = new Date().toISOString();
  sessionsMemory.set(session.id, session);
  await upsertAgentSession(session);
}

export async function listSessions(): Promise<AgentSession[]> {
  const disk = await listAgentSessionRows(100);
  const map = new Map(disk.map((s) => [s.id, s]));
  sessionsMemory.forEach((s, id) => map.set(id, s));
  return Array.from(map.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function removeSession(id: string): Promise<AgentSession | null> {
  sessionsMemory.delete(id);
  return deleteAgentSessionRow(id);
}

/** Wipe in-memory + Supabase agent sessions for a clean operator baseline. */
export async function clearAllSessions(): Promise<number> {
  sessionsMemory.clear();
  listeners.clear();
  const n = await clearAllAgentSessionRows();
  await publishAccountingTick("sessions_cleared", { cleared: n });
  return n;
}

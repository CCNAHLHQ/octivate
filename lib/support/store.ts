import { readCollection, writeCollection, uid } from "@/lib/store/json-store";
import { emitOpsEvent } from "@/lib/ops/event-log";
import type {
  SupportAttachment,
  SupportClientMeta,
  SupportMessage,
  SupportThread,
  SupportThreadStatus,
} from "@/lib/support/types";
import type { StaffProfileId } from "@/lib/auth/types";

const STORE = "support-threads";
const listeners = new Set<(thread: SupportThread) => void>();
const typingListeners = new Set<(event: SupportTypingEvent) => void>();
const typingByThread = new Map<string, SupportTypingState>();
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_ATTACHMENT_BYTES = 1_500_000;
const MAX_ATTACHMENTS = 3;
const MAX_DATA_URL_CHARS = Math.ceil(MAX_ATTACHMENT_BYTES * 1.4) + 64;
const TYPING_TTL_MS = 4200;

export type SupportTypingState = {
  threadId: string;
  role: "user" | "operator";
  name?: string;
  at: string;
};

export type SupportTypingEvent = {
  threadId: string;
  typing: SupportTypingState | null;
};

function notify(thread: SupportThread) {
  listeners.forEach((fn) => {
    try {
      fn(thread);
    } catch {
      /* ignore */
    }
  });
}

function notifyTyping(event: SupportTypingEvent) {
  typingListeners.forEach((fn) => {
    try {
      fn(event);
    } catch {
      /* ignore */
    }
  });
}

export function subscribeSupport(fn: (thread: SupportThread) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function subscribeSupportTyping(
  fn: (event: SupportTypingEvent) => void
): () => void {
  typingListeners.add(fn);
  return () => typingListeners.delete(fn);
}

export function getSupportTyping(threadId: string): SupportTypingState | null {
  return typingByThread.get(threadId) || null;
}

export function setSupportTyping(input: {
  threadId: string;
  role: "user" | "operator";
  name?: string;
  active: boolean;
}): SupportTypingState | null {
  const { threadId, role, name, active } = input;
  const prior = typingTimers.get(threadId);
  if (prior) clearTimeout(prior);
  typingTimers.delete(threadId);

  if (!active) {
    typingByThread.delete(threadId);
    notifyTyping({ threadId, typing: null });
    return null;
  }

  const state: SupportTypingState = {
    threadId,
    role,
    name: name?.slice(0, 80) || undefined,
    at: new Date().toISOString(),
  };
  typingByThread.set(threadId, state);
  notifyTyping({ threadId, typing: state });
  typingTimers.set(
    threadId,
    setTimeout(() => {
      const current = typingByThread.get(threadId);
      if (!current || current.at !== state.at) return;
      typingByThread.delete(threadId);
      typingTimers.delete(threadId);
      notifyTyping({ threadId, typing: null });
    }, TYPING_TTL_MS)
  );
  return state;
}

function sanitizeBody(body: string): string {
  return String(body || "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, 4000);
}

function sanitizeAttachments(raw: unknown): SupportAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: SupportAttachment[] = [];
  for (const row of raw.slice(0, MAX_ATTACHMENTS)) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const mime = String(item.mime || "");
    const dataUrl = String(item.dataUrl || "");
    const size = Number(item.size || 0);
    const name = String(item.name || "image")
      .replace(/[^\w.\- ()]/g, "_")
      .slice(0, 80);
    if (!ALLOWED_MIME.has(mime)) continue;
    if (!Number.isFinite(size) || size <= 0 || size > MAX_ATTACHMENT_BYTES) continue;
    if (dataUrl.length > MAX_DATA_URL_CHARS) continue;
    if (!dataUrl.startsWith(`data:${mime};base64,`)) continue;
    if (/[<>]/.test(name) || /javascript:/i.test(dataUrl)) continue;
    out.push({
      id: uid("satt"),
      name: name || "image",
      mime: mime as SupportAttachment["mime"],
      size,
      dataUrl,
    });
  }
  return out;
}

function sanitizeClientMeta(raw?: SupportClientMeta | null): SupportClientMeta | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return {
    ip: String(raw.ip || "").slice(0, 64) || undefined,
    userAgent: String(raw.userAgent || "").slice(0, 400) || undefined,
    browser: String(raw.browser || "").slice(0, 40) || undefined,
    os: String(raw.os || "").slice(0, 40) || undefined,
    language: String(raw.language || "").slice(0, 32) || undefined,
    capturedAt: new Date().toISOString(),
  };
}

export async function listSupportThreads(opts?: {
  includeArchived?: boolean;
}): Promise<SupportThread[]> {
  const rows = await readCollection<SupportThread>(STORE, []);
  // Drop legacy guest-only threads (no userId) from redesign onward.
  return rows
    .filter((t) => Boolean(t.userId))
    .filter((t) => (opts?.includeArchived ? true : !t.archivedAt))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function getSupportThread(id: string): Promise<SupportThread | null> {
  const rows = await listSupportThreads({ includeArchived: true });
  return rows.find((t) => t.id === id) || null;
}

export async function createSupportThread(input: {
  userId: string;
  email: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string | null;
  subject: string;
  body: string;
  attachments?: unknown;
  clientMeta?: SupportClientMeta;
}): Promise<SupportThread> {
  if (!input.userId) throw new Error("Sign in required to open support");
  const email = String(input.email || "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
  if (!email) throw new Error("Account email required");
  const subject =
    String(input.subject || "Support request").trim().slice(0, 160) || "Support request";
  const body = sanitizeBody(input.body);
  const attachments = sanitizeAttachments(input.attachments);
  if (!body && attachments.length === 0) throw new Error("Message required");

  const now = new Date().toISOString();
  const message: SupportMessage = {
    id: uid("smsg"),
    role: "user",
    body: body || "(image attached)",
    at: now,
    attachments: attachments.length ? attachments : undefined,
  };
  const thread: SupportThread = {
    id: uid("sthread"),
    userId: input.userId,
    email,
    displayName: input.displayName?.slice(0, 80),
    username: input.username?.slice(0, 64),
    avatarUrl: input.avatarUrl || null,
    subject,
    status: "open",
    createdAt: now,
    updatedAt: now,
    clientMeta: sanitizeClientMeta(input.clientMeta),
    messages: [message],
  };

  const rows = await listSupportThreads({ includeArchived: true });
  rows.unshift(thread);
  await writeCollection(STORE, rows.slice(0, 500));
  notify(thread);
  void emitOpsEvent({
    level: "info",
    source: "support",
    message: `thread_opened · ${subject}`,
    meta: {
      threadId: thread.id,
      userId: thread.userId,
      email,
      ip: thread.clientMeta?.ip,
      browser: thread.clientMeta?.browser,
    },
  });
  return thread;
}

export async function appendSupportMessage(input: {
  threadId: string;
  role: "user" | "operator";
  body: string;
  userId?: string;
  asOperator?: boolean;
  attachments?: unknown;
  staffProfileId?: StaffProfileId;
  staffName?: string;
  quickReplyId?: string;
  clientMeta?: SupportClientMeta;
}): Promise<SupportThread> {
  const body = sanitizeBody(input.body);
  const attachments = sanitizeAttachments(input.attachments);
  if (!body && attachments.length === 0) throw new Error("Message required");

  const rows = await listSupportThreads({ includeArchived: true });
  const idx = rows.findIndex((t) => t.id === input.threadId);
  if (idx < 0) throw new Error("Thread not found");
  const thread = { ...rows[idx] };

  if (!input.asOperator) {
    if (!input.userId || input.userId !== thread.userId) {
      throw new Error("Unauthorized");
    }
  }

  if (thread.status === "closed") {
    throw new Error(
      "This conversation is resolved. Start a new conversation to continue."
    );
  }

  const msg: SupportMessage = {
    id: uid("smsg"),
    role: input.role,
    body: body || "(image attached)",
    at: new Date().toISOString(),
    attachments: attachments.length ? attachments : undefined,
    staffProfileId: input.staffProfileId,
    staffName: input.staffName,
    quickReplyId: input.quickReplyId,
  };
  thread.messages = [...thread.messages, msg];
  thread.updatedAt = msg.at;
  if (input.role === "operator") {
    thread.status = "pending";
    if (input.staffProfileId) {
      thread.assignedStaffId = input.staffProfileId;
      thread.assignedStaffName = input.staffName;
    }
  }
  if (input.role === "user") {
    thread.status = "open";
    if (input.clientMeta) {
      thread.clientMeta = {
        ...thread.clientMeta,
        ...sanitizeClientMeta(input.clientMeta),
      };
    }
  }
  rows[idx] = thread;
  await writeCollection(STORE, rows);
  setSupportTyping({
    threadId: thread.id,
    role: input.role === "operator" ? "operator" : "user",
    active: false,
  });
  notify(thread);
  void emitOpsEvent({
    level: "info",
    source: "support",
    message: `message_${input.role} · ${thread.subject}`,
    meta: {
      threadId: thread.id,
      staffProfileId: input.staffProfileId,
      quickReplyId: input.quickReplyId,
    },
  });
  return thread;
}

export async function setSupportStatus(
  threadId: string,
  status: SupportThreadStatus
): Promise<SupportThread> {
  const rows = await listSupportThreads({ includeArchived: true });
  const idx = rows.findIndex((t) => t.id === threadId);
  if (idx < 0) throw new Error("Thread not found");
  const current = rows[idx];
  if (current.status === "closed" && status !== "closed") {
    throw new Error(
      "Resolved conversations stay closed. Ask the customer to start a new conversation."
    );
  }
  const next: SupportThread = {
    ...current,
    status,
    updatedAt: new Date().toISOString(),
  };
  if (status !== "closed") delete next.archivedAt;
  rows[idx] = next;
  await writeCollection(STORE, rows);
  notify(rows[idx]);
  void emitOpsEvent({
    level: "info",
    source: "support",
    message: `thread_${status}`,
    meta: { threadId },
  });
  return rows[idx];
}

export async function archiveSupportThread(threadId: string): Promise<SupportThread> {
  const rows = await listSupportThreads({ includeArchived: true });
  const idx = rows.findIndex((t) => t.id === threadId);
  if (idx < 0) throw new Error("Thread not found");
  if (rows[idx].status !== "closed") {
    throw new Error("Only resolved conversations can be archived");
  }
  const now = new Date().toISOString();
  rows[idx] = { ...rows[idx], archivedAt: now, updatedAt: now };
  await writeCollection(STORE, rows);
  notify(rows[idx]);
  void emitOpsEvent({
    level: "info",
    source: "support",
    message: "thread_archived",
    meta: { threadId },
  });
  return rows[idx];
}

export async function archiveClosedSupportThreads(): Promise<{ archived: number }> {
  const rows = await listSupportThreads({ includeArchived: true });
  const now = new Date().toISOString();
  let archived = 0;
  const next = rows.map((t) => {
    if (t.status !== "closed" || t.archivedAt) return t;
    archived += 1;
    const updated = { ...t, archivedAt: now, updatedAt: now };
    notify(updated);
    return updated;
  });
  if (archived) await writeCollection(STORE, next);
  if (archived) {
    void emitOpsEvent({
      level: "info",
      source: "support",
      message: `threads_archived_batch · ${archived}`,
      meta: { archived },
    });
  }
  return { archived };
}

export async function assignSupportStaff(
  threadId: string,
  staffProfileId: StaffProfileId | undefined,
  staffName: string
): Promise<SupportThread> {
  const rows = await listSupportThreads({ includeArchived: true });
  const idx = rows.findIndex((t) => t.id === threadId);
  if (idx < 0) throw new Error("Thread not found");
  rows[idx] = {
    ...rows[idx],
    assignedStaffId: staffProfileId,
    assignedStaffName: staffName.slice(0, 80),
    updatedAt: new Date().toISOString(),
  };
  await writeCollection(STORE, rows);
  notify(rows[idx]);
  return rows[idx];
}

export function publicThread(thread: SupportThread): SupportThread {
  return thread;
}

export function leanThread(thread: SupportThread): SupportThread {
  return {
    ...thread,
    messages: thread.messages.map((m) => ({
      ...m,
      attachments: m.attachments?.map(({ dataUrl: _d, ...meta }) => meta),
    })),
  };
}

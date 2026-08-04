/** Operator dashboard in-app notification feed (device-local). */

import { setLocationHash } from "@/lib/navigation/hash";

export const OPERATOR_NOTIFICATIONS_KEY = "octivate-operator-notifications";
export const OPERATOR_NOTIFICATIONS_EVENT = "octivate:operator-notifications";
export const SUPPORT_OPEN_EVENT = "octivate:support-open";
export const SUPPORT_THREAD_STORAGE_KEY = "octivate-support-thread";

export type OperatorNotificationKind = "support_message";

export type OperatorNotification = {
  id: string;
  kind: OperatorNotificationKind;
  title: string;
  body: string;
  at: string;
  threadId: string;
  accountName?: string;
  read: boolean;
};

const MAX_ITEMS = 40;

type Listener = (items: OperatorNotification[]) => void;

const listeners = new Set<Listener>();

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function emit(items: OperatorNotification[]) {
  listeners.forEach((fn) => {
    try {
      fn(items);
    } catch {
      /* ignore */
    }
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(OPERATOR_NOTIFICATIONS_EVENT, { detail: items })
    );
  }
}

export function readOperatorNotifications(): OperatorNotification[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(OPERATOR_NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OperatorNotification[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((n) => n && typeof n.id === "string" && typeof n.threadId === "string")
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function writeOperatorNotifications(items: OperatorNotification[]) {
  const next = items.slice(0, MAX_ITEMS);
  if (canUseStorage()) {
    try {
      localStorage.setItem(OPERATOR_NOTIFICATIONS_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  }
  emit(next);
  return next;
}

export function subscribeOperatorNotifications(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function countUnreadNotifications(
  items: OperatorNotification[] = readOperatorNotifications()
): number {
  return items.filter((n) => !n.read).length;
}

export function pushOperatorNotification(
  input: Omit<OperatorNotification, "read"> & { read?: boolean }
): OperatorNotification[] {
  const current = readOperatorNotifications();
  if (current.some((n) => n.id === input.id)) return current;
  const row: OperatorNotification = {
    id: input.id,
    kind: input.kind,
    title: input.title,
    body: input.body,
    at: input.at || new Date().toISOString(),
    threadId: input.threadId,
    accountName: input.accountName,
    read: Boolean(input.read),
  };
  return writeOperatorNotifications([row, ...current]);
}

export function markOperatorNotificationRead(id: string): OperatorNotification[] {
  const next = readOperatorNotifications().map((n) =>
    n.id === id ? { ...n, read: true } : n
  );
  return writeOperatorNotifications(next);
}

export function markAllOperatorNotificationsRead(): OperatorNotification[] {
  const next = readOperatorNotifications().map((n) => ({ ...n, read: true }));
  return writeOperatorNotifications(next);
}

export function clearOperatorNotifications(): OperatorNotification[] {
  return writeOperatorNotifications([]);
}

export function removeOperatorNotification(id: string): OperatorNotification[] {
  return writeOperatorNotifications(
    readOperatorNotifications().filter((n) => n.id !== id)
  );
}

/** Format notification timestamp for UI (date + time). */
export function formatNotificationWhen(iso: string, now = Date.now()): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  const sameDay =
    d.getFullYear() === new Date(now).getFullYear() &&
    d.getMonth() === new Date(now).getMonth() &&
    d.getDate() === new Date(now).getDate();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Today · ${time}`;
  const date = d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date(now).getFullYear() ? "numeric" : undefined,
  });
  return `${date} · ${time}`;
}

/** Navigate to operator Customer Support and open a thread. */
export function openOperatorSupportThread(threadId: string): void {
  if (typeof window === "undefined" || !threadId) return;
  try {
    window.sessionStorage.setItem(SUPPORT_THREAD_STORAGE_KEY, threadId);
  } catch {
    /* ignore */
  }
  const onOperator =
    window.location.pathname.includes("/dashboard/operator") ||
    window.location.pathname === "/operator" ||
    window.location.pathname.startsWith("/operator/");
  if (!onOperator) {
    window.location.assign(`/dashboard/operator#support`);
  } else {
    setLocationHash("support");
  }
  window.dispatchEvent(
    new CustomEvent(SUPPORT_OPEN_EVENT, { detail: { threadId } })
  );
}

export function consumePendingSupportThread(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const id = window.sessionStorage.getItem(SUPPORT_THREAD_STORAGE_KEY);
    if (id) window.sessionStorage.removeItem(SUPPORT_THREAD_STORAGE_KEY);
    return id;
  } catch {
    return null;
  }
}

"use client";

/**
 * Always-mounted support SSE listener for the operator console.
 * Pushes in-app notifications + clickable toasts even when Customer Support tab is hidden.
 */

import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";
import { getClientApiKey } from "@/lib/api-client";
import {
  formatNotificationWhen,
  openOperatorSupportThread,
  pushOperatorNotification,
  SUPPORT_THREAD_STORAGE_KEY,
} from "@/lib/operator/notifications";
import type { SupportThread } from "@/lib/support/types";

function readSsePayloads(buf: string, onPayload: (data: unknown) => void): string {
  const chunks = buf.split("\n\n");
  const rest = chunks.pop() || "";
  for (const chunk of chunks) {
    const line = chunk.split("\n").find((l) => l.startsWith("data: "));
    if (!line) continue;
    try {
      onPayload(JSON.parse(line.slice(6)));
    } catch {
      /* ignore */
    }
  }
  return rest;
}

function accountLabel(t: SupportThread) {
  return t.displayName || t.username || t.email || "Account";
}

function alertNewUserMessage(thread: SupportThread, messageId: string, body: string, at: string) {
  const who = accountLabel(thread);
  const snippet = body.replace(/\s+/g, " ").slice(0, 90);
  const when = formatNotificationWhen(at);
  const href = `/dashboard/operator#support`;

  pushOperatorNotification({
    id: messageId,
    kind: "support_message",
    title: `Support · ${who}`,
    body: snippet + (body.length > 90 ? "…" : ""),
    at,
    threadId: thread.id,
    accountName: who,
  });

  toast.info(`${who}: ${snippet}${body.length > 90 ? "…" : ""}`, {
    forceNew: true,
    durationMs: 12_000,
    meta: when,
    onClick: () => openOperatorSupportThread(thread.id),
    href,
  });

  try {
    window.sessionStorage.setItem(SUPPORT_THREAD_STORAGE_KEY, thread.id);
  } catch {
    /* ignore */
  }

  void import("@/lib/alerts/notify").then(({ octivateAlert }) =>
    octivateAlert({
      kind: "message",
      title: `Support · ${who}`,
      body: `${snippet}${body.length > 90 ? "…" : ""} · ${when}`,
      href,
      onClick: () => openOperatorSupportThread(thread.id),
      desktop: true,
    })
  );
}

export function OperatorSupportAlerts() {
  const lastAlertedUserMsg = useRef("");
  const alertsArmed = useRef(false);

  useEffect(() => {
    const key = getClientApiKey();
    const ctrl = new AbortController();
    let cancelled = false;
    let pollTimer: number | undefined;
    let retryTimer: number | undefined;

    async function armFromThreads(threads: SupportThread[]) {
      if (alertsArmed.current) return;
      const latestUser = threads
        .flatMap((t) => t.messages || [])
        .filter((m) => m.role === "user")
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
      if (latestUser) lastAlertedUserMsg.current = latestUser.id;
      alertsArmed.current = true;
    }

    async function pollOnce() {
      try {
        const res = await fetch("/api/operator/support", {
          headers: key ? { Authorization: `Bearer ${key}` } : {},
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { threads?: SupportThread[] };
        const threads = data.threads || [];
        if (!alertsArmed.current) {
          await armFromThreads(threads);
          return;
        }
        const latestUser = threads
          .flatMap((t) => (t.messages || []).map((m) => ({ t, m })))
          .filter((row) => row.m.role === "user")
          .sort((a, b) => Date.parse(b.m.at) - Date.parse(a.m.at))[0];
        if (latestUser && latestUser.m.id !== lastAlertedUserMsg.current) {
          lastAlertedUserMsg.current = latestUser.m.id;
          alertNewUserMessage(latestUser.t, latestUser.m.id, latestUser.m.body, latestUser.m.at);
        }
      } catch {
        /* ignore */
      }
    }

    async function runStream() {
      try {
        const res = await fetch("/api/operator/support/stream", {
          headers: key ? { Authorization: `Bearer ${key}` } : {},
          credentials: "include",
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!res.ok || !res.body) throw new Error("stream unavailable");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          buf = readSsePayloads(buf, (payload) => {
            const row = payload as {
              type?: string;
              threads?: SupportThread[];
              thread?: SupportThread;
            };
            if (row.type === "snapshot" && row.threads) {
              void armFromThreads(row.threads);
              return;
            }
            if (!row.thread || row.thread.archivedAt) return;
            const latestUser = [...(row.thread.messages || [])]
              .reverse()
              .find((m) => m.role === "user");
            if (!alertsArmed.current) {
              if (latestUser) lastAlertedUserMsg.current = latestUser.id;
              alertsArmed.current = true;
              return;
            }
            if (latestUser && latestUser.id !== lastAlertedUserMsg.current) {
              lastAlertedUserMsg.current = latestUser.id;
              alertNewUserMessage(
                row.thread,
                latestUser.id,
                latestUser.body,
                latestUser.at
              );
            }
          });
        }
        throw new Error("stream ended");
      } catch {
        if (cancelled) return;
        void pollOnce();
        if (!pollTimer) {
          pollTimer = window.setInterval(() => void pollOnce(), 20_000);
        }
        retryTimer = window.setTimeout(() => {
          if (!cancelled) void runStream();
        }, 8_000);
      }
    }

    void runStream();
    return () => {
      cancelled = true;
      ctrl.abort();
      if (pollTimer) window.clearInterval(pollTimer);
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, []);

  return null;
}

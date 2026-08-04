"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Clock3,
  Globe2,
  ImagePlus,
  LifeBuoy,
  MonitorSmartphone,
  Radio,
  Send,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import {
  SafeAttachmentThumb,
  SafeImageLightbox,
} from "@/components/support/safe-image-preview";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { apiFetch, getClientApiKey } from "@/lib/api-client";
import {
  consumePendingSupportThread,
  markOperatorNotificationRead,
  readOperatorNotifications,
  SUPPORT_OPEN_EVENT,
} from "@/lib/operator/notifications";
import {
  readSupportImageAttachment,
  SUPPORT_MAX_ATTACHMENTS,
} from "@/lib/support/attachments";
import {
  OPERATOR_QUICK_REPLIES,
  type SupportAttachment,
  type SupportThread,
  type SupportThreadStatus,
} from "@/lib/support/types";
import type { PublicUser } from "@/lib/auth/types";
import { PRESENCE_OPTIONS } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import "@/app/support/support-widget.css";

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

function mergeLeanThread(prev: SupportThread[], next: SupportThread): SupportThread[] {
  const idx = prev.findIndex((t) => t.id === next.id);
  if (idx < 0) return [next, ...prev];
  const copy = [...prev];
  const existing = copy[idx];
  const mergedMessages = next.messages.map((m) => {
    const prior = existing.messages.find((row) => row.id === m.id);
    if (!prior?.attachments?.length) return m;
    return {
      ...m,
      attachments: m.attachments?.map((att) => {
        const full = prior.attachments?.find((a) => a.id === att.id);
        return full?.dataUrl ? { ...att, dataUrl: full.dataUrl } : att;
      }),
    };
  });
  copy[idx] = { ...next, messages: mergedMessages };
  return copy.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

function statusLabel(status: SupportThreadStatus) {
  if (status === "closed") return "Resolved";
  if (status === "pending") return "Awaiting customer";
  return "Open";
}

function presenceLabel(status?: PublicUser["presenceStatus"]) {
  return PRESENCE_OPTIONS.find((p) => p.id === (status || "available"))?.label || "Available";
}

function accountLabel(t: SupportThread) {
  return t.displayName || t.username || t.email || "Account";
}

export function OperatorSupportInbox() {
  const [staff, setStaff] = useState<PublicUser | null>(null);
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [quickReplies, setQuickReplies] = useState(OPERATOR_QUICK_REPLIES);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeFull, setActiveFull] = useState<SupportThread | null>(null);
  const [reply, setReply] = useState("");
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<SupportAttachment | null>(null);
  const [filter, setFilter] = useState<"all" | SupportThreadStatus>("all");
  const [syncState, setSyncState] = useState<"live" | "reconnecting">("live");
  const [peerTyping, setPeerTyping] = useState<{
    threadId: string;
    role: "user" | "operator";
    name?: string;
  } | null>(null);
  const typingTimer = useRef<number | undefined>(undefined);
  const typingActive = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadList = useCallback(async () => {
    const res = await apiFetch<{
      threads: SupportThread[];
      quickReplies?: typeof OPERATOR_QUICK_REPLIES;
    }>("/api/operator/support", { skipCache: true });
    setThreads(res.threads || []);
    if (res.quickReplies?.length) setQuickReplies(res.quickReplies);
    setActiveId((prev) => prev || res.threads?.[0]?.id || null);
  }, []);

  const loadFull = useCallback(async (id: string) => {
    const res = await apiFetch<{ thread: SupportThread }>(
      `/api/operator/support?id=${encodeURIComponent(id)}`,
      { skipCache: true }
    );
    setActiveFull(res.thread);
    setThreads((prev) => mergeLeanThread(prev, res.thread));
  }, []);

  useEffect(() => {
    void loadList()
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load inbox"))
      .finally(() => setLoading(false));
  }, [loadList]);

  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { user?: PublicUser | null }) => setStaff(data.user || null))
      .catch(() => setStaff(null));
  }, []);

  useEffect(() => {
    if (!activeId) {
      setActiveFull(null);
      return;
    }
    setReply("");
    setAttachments([]);
    void loadFull(activeId).catch(() => setActiveFull(null));
  }, [activeId, loadFull]);

  // Deep-link from notification toast / floating panel.
  useEffect(() => {
    function openThread(threadId: string) {
      if (!threadId) return;
      setActiveId(threadId);
      setFilter("all");
    }
    const pending = consumePendingSupportThread();
    if (pending) openThread(pending);

    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ threadId?: string }>).detail;
      if (detail?.threadId) openThread(detail.threadId);
    };
    window.addEventListener(SUPPORT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(SUPPORT_OPEN_EVENT, onOpen);
  }, []);

  // Always-on SSE with poll fallback — no toggle.
  useEffect(() => {
    const key = getClientApiKey();
    const ctrl = new AbortController();
    let cancelled = false;
    let pollTimer: number | undefined;
    let retryTimer: number | undefined;

    async function runStream() {
      setSyncState("live");
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
              threadId?: string;
              typing?: { role: "user" | "operator"; name?: string; threadId?: string } | null;
            };
            if (row.type === "snapshot" && row.threads) {
              setThreads(row.threads);
              return;
            }
            if (row.type === "typing") {
              const tid = row.threadId || row.typing?.threadId;
              if (!tid) return;
              if (row.typing && row.typing.role === "user") {
                setPeerTyping({
                  threadId: tid,
                  role: "user",
                  name: row.typing.name,
                });
              } else {
                setPeerTyping((prev) => (prev?.threadId === tid ? null : prev));
              }
              return;
            }
            if (row.thread) {
              if (row.thread.archivedAt) {
                setThreads((prev) => prev.filter((t) => t.id !== row.thread!.id));
                if (row.thread.id === activeId) {
                  setActiveId(null);
                  setActiveFull(null);
                }
                return;
              }
              setThreads((prev) => mergeLeanThread(prev, row.thread!));
              if (row.thread.id === activeId) {
                void loadFull(row.thread.id).catch(() => {});
              }
            }
          });
        }
      } catch {
        if (cancelled) return;
        setSyncState("reconnecting");
      }
      if (!cancelled) {
        pollTimer = window.setInterval(() => {
          void loadList().catch(() => {});
          if (activeId) void loadFull(activeId).catch(() => {});
        }, 12_000);
        retryTimer = window.setTimeout(() => {
          if (pollTimer) window.clearInterval(pollTimer);
          void runStream();
        }, 20_000);
      }
    }

    void runStream();
    return () => {
      cancelled = true;
      ctrl.abort();
      if (pollTimer) window.clearInterval(pollTimer);
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [activeId, loadList, loadFull]);

  const filtered = useMemo(() => {
    // Archived threads are already omitted from the API list.
    if (filter === "all") return threads;
    return threads.filter((t) => t.status === filter);
  }, [threads, filter]);

  const resolvedCount = useMemo(
    () => threads.filter((t) => t.status === "closed").length,
    [threads]
  );

  const active = useMemo(() => {
    if (activeFull && activeFull.id === activeId) return activeFull;
    return threads.find((t) => t.id === activeId) || null;
  }, [threads, activeId, activeFull]);

  const openCount = useMemo(
    () => threads.filter((t) => t.status !== "closed").length,
    [threads]
  );

  useEffect(() => {
    if (!activeId) return;
    if (!threads.some((t) => t.id === activeId)) {
      setActiveId(filtered[0]?.id || threads[0]?.id || null);
      setActiveFull(null);
    }
  }, [threads, filtered, activeId]);

  // Mark matching support notifications read when a thread is opened.
  useEffect(() => {
    if (!activeId) return;
    readOperatorNotifications()
      .filter((n) => n.threadId === activeId && !n.read)
      .forEach((n) => markOperatorNotificationRead(n.id));
  }, [activeId]);

  const pulseTyping = useCallback(
    (activeThreadId: string | null, active: boolean) => {
      if (!activeThreadId) return;
      if (active) {
        if (!typingActive.current) {
          typingActive.current = true;
          void apiFetch(`/api/support/threads/${activeThreadId}/typing`, {
            method: "POST",
            json: { active: true },
          }).catch(() => {});
        }
        if (typingTimer.current) window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => {
          typingActive.current = false;
          void apiFetch(`/api/support/threads/${activeThreadId}/typing`, {
            method: "POST",
            json: { active: false },
          }).catch(() => {});
        }, 2800);
        return;
      }
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      if (!typingActive.current) return;
      typingActive.current = false;
      void apiFetch(`/api/support/threads/${activeThreadId}/typing`, {
        method: "POST",
        json: { active: false },
      }).catch(() => {});
    },
    []
  );

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    try {
      const next: SupportAttachment[] = [];
      for (const file of Array.from(files).slice(0, SUPPORT_MAX_ATTACHMENTS)) {
        next.push(await readSupportImageAttachment(file));
      }
      setAttachments((prev) => [...prev, ...next].slice(0, SUPPORT_MAX_ATTACHMENTS));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not attach image");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function sendReply(body?: string, quickReplyId?: string) {
    if (!active) return;
    const text = (body ?? reply).trim();
    if (!text && !quickReplyId && attachments.length === 0) return;
    pulseTyping(active.id, false);
    setSending(true);
    try {
      const res = await apiFetch<{ thread: SupportThread }>("/api/operator/support", {
        method: "PATCH",
        json: {
          id: active.id,
          body: text || undefined,
          quickReplyId,
          attachments: quickReplyId ? undefined : attachments,
          assign: true,
          staffProfileId: staff?.staffProfileId,
        },
      });
      setReply("");
      setAttachments([]);
      if (res.thread) {
        setActiveFull(res.thread);
        setThreads((prev) => mergeLeanThread(prev, res.thread));
      } else {
        await loadFull(active.id);
      }
      toast.success(quickReplyId ? "Quick reply sent" : "Reply sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function setStatus(status: SupportThreadStatus) {
    if (!active) return;
    try {
      const res = await apiFetch<{ thread: SupportThread }>("/api/operator/support", {
        method: "PATCH",
        json: { id: active.id, status },
      });
      if (res.thread) {
        setActiveFull(res.thread);
        setThreads((prev) => mergeLeanThread(prev, res.thread));
      }
      toast.success(status === "closed" ? "Thread resolved" : `Marked ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function claimThread() {
    if (!active) return;
    try {
      const res = await apiFetch<{ thread: SupportThread }>("/api/operator/support", {
        method: "PATCH",
        json: {
          id: active.id,
          assign: true,
          staffProfileId: staff?.staffProfileId,
        },
      });
      if (res.thread) {
        setActiveFull(res.thread);
        setThreads((prev) => mergeLeanThread(prev, res.thread));
      }
      toast.success("Conversation assigned to you");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Assign failed");
    }
  }

  async function archiveThread(id: string) {
    try {
      await apiFetch<{ thread: SupportThread }>("/api/operator/support", {
        method: "PATCH",
        json: { id, archive: true },
      });
      setThreads((prev) => prev.filter((t) => t.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setActiveFull(null);
      }
      toast.success("Resolved conversation archived");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Archive failed");
    }
  }

  async function archiveAllResolved() {
    try {
      const res = await apiFetch<{
        archived: number;
        threads: SupportThread[];
      }>("/api/operator/support", {
        method: "PATCH",
        json: { archiveAllClosed: true },
      });
      setThreads(res.threads || []);
      setActiveId(null);
      setActiveFull(null);
      toast.success(
        res.archived
          ? `Archived ${res.archived} resolved conversation${res.archived === 1 ? "" : "s"}`
          : "No resolved conversations to archive"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Archive failed");
    }
  }

  if (loading) return <p className="text-sm text-mist">Loading support inbox…</p>;

  const meta = active?.clientMeta;

  return (
    <div className="op-support">
      <div className="op-support-list">
        <div className="op-support-list-head">
          <span className="op-support-list-title">
            <LifeBuoy className="h-4 w-4 text-tide" aria-hidden />
            Customer Support
            {openCount > 0 ? <span className="op-support-count">{openCount}</span> : null}
          </span>
          <Tooltip
            content={
              syncState === "live"
                ? "Inbox sync is always on"
                : "Reconnecting — polling until stream recovers"
            }
            side="bottom"
          >
            <span className={cn("op-support-sync", syncState === "live" && "is-live")}>
              <Radio className="h-3 w-3" aria-hidden />
              {syncState === "live" ? "Live" : "Sync…"}
            </span>
          </Tooltip>
        </div>

        <div className="op-support-filters" role="tablist" aria-label="Thread filters">
          {(
            [
              ["all", "All"],
              ["open", "Open"],
              ["pending", "Pending"],
              ["closed", "Resolved"],
            ] as const
          ).map(([id, label]) => (
            <Tooltip key={id} content={`Show ${label.toLowerCase()} conversations`} side="bottom">
              <button
                type="button"
                role="tab"
                aria-selected={filter === id}
                className={cn("op-support-filter", filter === id && "is-active")}
                onClick={() => setFilter(id)}
              >
                {label}
                {id === "closed" && resolvedCount > 0 ? ` · ${resolvedCount}` : ""}
              </button>
            </Tooltip>
          ))}
          {filter === "closed" && resolvedCount > 0 ? (
            <Tooltip content="Archive all resolved conversations from the active inbox" side="bottom">
              <button
                type="button"
                className="op-support-filter op-support-archive-all"
                onClick={() => void archiveAllResolved()}
              >
                <Archive className="h-3 w-3" aria-hidden />
                Archive all
              </button>
            </Tooltip>
          ) : null}
        </div>

        <div className="op-support-list-scroll" aria-label="Support conversations">
          {filtered.length === 0 ? (
            <p className="op-debug-empty">No account threads in this view.</p>
          ) : (
            filtered.map((t) => (
              <Tooltip
                key={t.id}
                className="op-support-item-tip"
                content={`${accountLabel(t)} · ${t.email} · ${statusLabel(t.status)}`}
                side="right"
              >
                <button
                  type="button"
                  className={cn("op-support-item", activeId === t.id && "is-active")}
                  onClick={() => setActiveId(t.id)}
                >
                  <span className="op-support-item-row">
                    <span className="op-support-avatar" aria-hidden>
                      {t.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.avatarUrl} alt="" />
                      ) : (
                        <UserRound className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="op-support-item-body">
                      <span className="op-support-item-title">{t.subject}</span>
                      <span className="op-support-item-meta">
                        {accountLabel(t)} · {statusLabel(t.status)}
                        {t.assignedStaffName ? ` · ${t.assignedStaffName}` : ""}
                        {peerTyping?.threadId === t.id && peerTyping.role === "user"
                          ? " · typing"
                          : ""}
                      </span>
                    </span>
                  </span>
                </button>
              </Tooltip>
            ))
          )}
        </div>

        <div className="op-support-list-meta">
          {filtered.length} conversation{filtered.length === 1 ? "" : "s"}
          {filter !== "all" ? ` · ${filter === "closed" ? "resolved" : filter}` : ""}
        </div>
      </div>

      <div className="op-support-pane">
        {!active ? (
          <p className="op-debug-empty">Select an account conversation to moderate.</p>
        ) : (
          <>
            <div className="op-support-pane-head">
              <div className="op-support-pane-identity">
                <span className="op-support-avatar is-lg" aria-hidden>
                  {active.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={active.avatarUrl} alt="" />
                  ) : (
                    <UserRound className="h-5 w-5" />
                  )}
                </span>
                <div>
                  <h3>{active.subject}</h3>
                  <p>
                    {accountLabel(active)} · {active.email} · {statusLabel(active.status)}
                  </p>
                  <p className="op-support-staff-line">
                    <Shield className="h-3 w-3" aria-hidden />
                    Staff:{" "}
                    {active.assignedStaffName ||
                      (staff?.displayName ? `${staff.displayName} (you, unassigned)` : "Unassigned")}
                    {staff?.staffProfileId
                      ? ` · ${presenceLabel(staff.presenceStatus)} · signed in as ${staff.displayName || staff.username}`
                      : staff?.presenceStatus
                        ? ` · ${presenceLabel(staff.presenceStatus)}`
                        : ""}
                  </p>
                </div>
              </div>
              <div className="op-support-actions">
                {active.status === "closed" ? (
                  <>
                    <span className="op-support-resolved-pill">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      Resolved
                    </span>
                    <Tooltip content="Archive this resolved conversation out of the inbox">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="op-support-action-btn"
                        onClick={() => void archiveThread(active.id)}
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Archive
                      </Button>
                    </Tooltip>
                  </>
                ) : (
                  <>
                    <Tooltip content="Assign this thread to your staff profile">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="op-support-action-btn"
                        onClick={() => void claimThread()}
                      >
                        Assign to me
                      </Button>
                    </Tooltip>
                    {active.status !== "pending" ? (
                      <Tooltip content="Mark as awaiting customer reply">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="op-support-action-btn"
                          onClick={() => void setStatus("pending")}
                        >
                          <Clock3 className="h-3.5 w-3.5" />
                          Waiting on customer
                        </Button>
                      </Tooltip>
                    ) : null}
                    <Tooltip content="Resolve and close this conversation">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="op-support-action-btn is-resolve"
                        onClick={() => void setStatus("closed")}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark resolved
                      </Button>
                    </Tooltip>
                  </>
                )}
              </div>
            </div>
            {active.status === "closed" ? (
              <div className="op-support-resolved-banner" role="status">
                Messaging is closed. The customer can start a new conversation from their
                support chat — do not reopen this thread for follow-ups.
              </div>
            ) : null}

            <div className="op-support-meta" aria-label="Client environment">
              <Tooltip content="Reported client IP at last contact" side="bottom">
                <span>
                  <Globe2 className="h-3 w-3" aria-hidden />
                  {meta?.ip || "IP unknown"}
                </span>
              </Tooltip>
              <Tooltip content="Browser family from user agent" side="bottom">
                <span>
                  <MonitorSmartphone className="h-3 w-3" aria-hidden />
                  {meta?.browser || "Browser unknown"}
                  {meta?.os ? ` · ${meta.os}` : ""}
                </span>
              </Tooltip>
              <Tooltip content={meta?.userAgent || "User agent not captured"} side="bottom">
                <span className="op-support-meta-ua">
                  UA: {(meta?.userAgent || "—").slice(0, 72)}
                  {(meta?.userAgent?.length || 0) > 72 ? "…" : ""}
                </span>
              </Tooltip>
            </div>

            <div className="op-support-messages">
              {active.messages.map((m) => (
                <div key={m.id} className={cn("op-support-bubble", `is-${m.role}`)}>
                  <span className="op-support-bubble-role">
                    {m.role === "operator"
                      ? m.staffName || "Staff"
                      : m.role === "user"
                        ? accountLabel(active)
                        : "System"}
                  </span>
                  <p>{m.body}</p>
                  {m.attachments?.length ? (
                    <div className="op-support-atts">
                      {m.attachments.map((att) => (
                        <SafeAttachmentThumb
                          key={att.id}
                          attachment={att}
                          onOpen={setPreview}
                          className="op-support-att"
                        />
                      ))}
                    </div>
                  ) : null}
                  <time>{new Date(m.at).toLocaleString()}</time>
                </div>
              ))}
            </div>
            {peerTyping?.threadId === active.id && peerTyping.role === "user" ? (
              <p className="op-support-typing" aria-live="polite">
                <span className="op-support-typing-dots" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
                {peerTyping.name || accountLabel(active)} is typing
              </p>
            ) : null}

            {active.status === "closed" ? null : (
              <div className="op-support-composer">
                <div className="op-support-quick" aria-label="Formal quick replies">
                  {quickReplies.map((q) => (
                    <Tooltip key={q.id} content={q.body} side="top">
                      <button
                        type="button"
                        className="op-support-quick-btn"
                        disabled={sending}
                        onClick={() => void sendReply(undefined, q.id)}
                      >
                        {q.label}
                      </button>
                    </Tooltip>
                  ))}
                </div>
                {attachments.length > 0 ? (
                  <div className="op-support-drafts">
                    {attachments.map((att) => (
                      <div key={att.id} className="scw-draft-att">
                        <SafeAttachmentThumb attachment={att} onOpen={setPreview} />
                        <button
                          type="button"
                          className="scw-draft-remove"
                          aria-label={`Remove ${att.name}`}
                          onClick={() =>
                            setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="op-support-composer-row">
                  <Tooltip content="Attach an image (PNG, JPEG, WebP, GIF · 1.5 MB)" side="top">
                    <button
                      type="button"
                      className="op-support-attach"
                      aria-label="Attach image"
                      disabled={sending || attachments.length >= SUPPORT_MAX_ATTACHMENTS}
                      onClick={() => fileRef.current?.click()}
                    >
                      <ImagePlus className="h-4 w-4" />
                    </button>
                  </Tooltip>
                  <input
                    ref={fileRef}
                    className="scw-file"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    onChange={(e) => void onPickFiles(e.target.files)}
                  />
                  <textarea
                    className="op-support-reply"
                    value={reply}
                    onChange={(e) => {
                      setReply(e.target.value);
                      if (e.target.value.trim()) pulseTyping(active.id, true);
                      else pulseTyping(active.id, false);
                    }}
                    placeholder="Compose a reply…"
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendReply();
                      }
                    }}
                  />
                </div>
                <Tooltip content="Send reply and assign the thread to you" side="top">
                  <button
                    type="button"
                    className={cn(
                      "op-support-send",
                      (reply.trim() || attachments.length > 0) && "is-ready"
                    )}
                    disabled={sending || (!reply.trim() && attachments.length === 0)}
                    onClick={() => void sendReply()}
                  >
                    <Send className="h-4 w-4" />
                    Send reply
                  </button>
                </Tooltip>
              </div>
            )}
          </>
        )}
      </div>
      <SafeImageLightbox attachment={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

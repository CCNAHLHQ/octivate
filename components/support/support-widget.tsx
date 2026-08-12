"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useMounted } from "@/lib/use-mounted";
import {
  CheckCircle2,
  Headphones,
  ImagePlus,
  MessageCircle,
  MessageSquarePlus,
  Minimize2,
  Send,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { OctivateLogoMark } from "@/components/brand/octivate-logo-mark";
import {
  SafeAttachmentThumb,
  SafeImageLightbox,
} from "@/components/support/safe-image-preview";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { useT } from "@/components/i18n/locale-provider";
import { apiFetch, getClientApiKey } from "@/lib/api-client";
import {
  readSupportImageAttachment,
  SUPPORT_MAX_ATTACHMENTS,
} from "@/lib/support/attachments";
import type { SupportAttachment, SupportThread } from "@/lib/support/types";
import type { PublicUser } from "@/lib/auth/types";
import { PRESENCE_OPTIONS } from "@/lib/auth/types";
import { cn } from "@/lib/utils";
import "@/app/support/support-widget.css";

const THREAD_KEY = "octivate-support-thread-id";
const SEEN_KEY = "octivate-support-seen-at";

const TOPIC_IDS = ["access", "briefs", "projects", "plans"] as const;

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

function clientHints() {
  return {
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    language: typeof navigator !== "undefined" ? navigator.language : "",
  };
}

export function SupportWidget({
  user,
}: {
  /** @deprecated Operators use the inbox; kept for call-site compatibility. */
  staffMode?: boolean;
  user: PublicUser | null;
}) {
  const t = useT();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<SupportThread | null>(null);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<SupportAttachment | null>(null);
  const [unseen, setUnseen] = useState(0);
  const [peerTyping, setPeerTyping] = useState<{
    role: "user" | "operator";
    name?: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAlertedOpMsg = useRef<string>("");
  const alertsArmed = useRef(false);
  const openRef = useRef(false);
  const typingTimer = useRef<number | undefined>(undefined);
  const typingActive = useRef(false);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const applyThread = useCallback((next: SupportThread | null) => {
    setThread((prev) => {
      if (next) {
        const latestOp = [...(next.messages || [])]
          .reverse()
          .find((m) => m.role === "operator");
        if (!alertsArmed.current) {
          if (latestOp) lastAlertedOpMsg.current = latestOp.id;
          alertsArmed.current = true;
        } else if (latestOp && latestOp.id !== lastAlertedOpMsg.current) {
          const prevOp = prev
            ? [...(prev.messages || [])].reverse().find((m) => m.role === "operator")
            : null;
          if (!prevOp || prevOp.id !== latestOp.id) {
            lastAlertedOpMsg.current = latestOp.id;
            if (!openRef.current) {
              void import("@/lib/alerts/notify").then(({ octivateAlert }) =>
                octivateAlert({
                  kind: "message",
                  title: t("support.chat.newReply"),
                  body: latestOp.body.slice(0, 120),
                  href: "/dashboard",
                  desktop: true,
                })
              );
            }
          }
        }
      } else {
        alertsArmed.current = false;
        lastAlertedOpMsg.current = "";
      }
      return next;
    });
    if (next?.id) {
      try {
        localStorage.setItem(THREAD_KEY, next.id);
      } catch {
        /* ignore */
      }
    }
  }, [t]);

  const topicPrompts = useMemo(
    () =>
      TOPIC_IDS.map((id) => ({
        id,
        label: t(`support.chat.topic.${id}`),
        text: t(`support.chat.canned.${id}`),
      })),
    [t]
  );

  // Drop legacy guest token keys from prior support UX.
  useEffect(() => {
    try {
      localStorage.removeItem("octivate-support-guest-token");
    } catch {
      /* ignore */
    }
  }, []);

  // Restore existing account thread
  useEffect(() => {
    if (!user || user.role === "operator") return;
    let cancelled = false;
    (async () => {
      try {
        const list = await apiFetch<{ threads: SupportThread[] }>("/api/support/threads", {
          skipCache: true,
        });
        const mine = list.threads || [];
        const stored =
          typeof window !== "undefined" ? localStorage.getItem(THREAD_KEY) || "" : "";
        // Prefer an open thread; fall back to a resolved one so history is visible
        // (composer is locked — user must start a new conversation).
        const match =
          mine.find((t) => t.id === stored && t.status !== "closed") ||
          mine.find((t) => t.status !== "closed") ||
          (stored ? mine.find((t) => t.id === stored) : null) ||
          mine.find((t) => t.status === "closed") ||
          null;
        if (!cancelled && match) {
          const full = await apiFetch<{ thread: SupportThread }>(
            `/api/support/threads/${encodeURIComponent(match.id)}`,
            { skipCache: true }
          );
          applyThread(full.thread);
        }
      } catch {
        /* not signed in or empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, applyThread]);

  // Always-on stream when a thread exists
  useEffect(() => {
    if (!user || user.role === "operator" || !thread?.id) return;
    const key = getClientApiKey();
    const ctrl = new AbortController();
    let cancelled = false;
    let pollTimer: number | undefined;
    let retryTimer: number | undefined;

    async function runStream() {
      try {
        const res = await fetch(`/api/support/threads/${thread!.id}/stream`, {
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
              thread?: SupportThread;
              typing?: { role: "user" | "operator"; name?: string } | null;
            };
            if (row.thread) applyThread(row.thread);
            if (row.type === "typing" || "typing" in row) {
              const t = row.typing;
              if (t && t.role === "operator") setPeerTyping(t);
              else setPeerTyping(null);
            }
          });
        }
      } catch {
        if (cancelled) return;
      }
      if (!cancelled) {
        pollTimer = window.setInterval(() => {
          void apiFetch<{ thread: SupportThread }>(
            `/api/support/threads/${thread!.id}`,
            { skipCache: true }
          )
            .then((r) => applyThread(r.thread))
            .catch(() => {});
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
      setPeerTyping(null);
      if (pollTimer) window.clearInterval(pollTimer);
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [user, thread?.id, applyThread]);

  const pulseTyping = useCallback(
    (active: boolean) => {
      if (!thread?.id || user?.role === "operator") return;
      if (active) {
        if (!typingActive.current) {
          typingActive.current = true;
          void apiFetch(`/api/support/threads/${thread.id}/typing`, {
            method: "POST",
            json: { active: true },
          }).catch(() => {});
        }
        if (typingTimer.current) window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => {
          typingActive.current = false;
          void apiFetch(`/api/support/threads/${thread.id}/typing`, {
            method: "POST",
            json: { active: false },
          }).catch(() => {});
        }, 2800);
        return;
      }
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      if (!typingActive.current) return;
      typingActive.current = false;
      void apiFetch(`/api/support/threads/${thread.id}/typing`, {
        method: "POST",
        json: { active: false },
      }).catch(() => {});
    },
    [thread?.id, user?.role]
  );

  useEffect(() => {
    if (!thread) {
      setUnseen(0);
      return;
    }
    const seenAt = Number(localStorage.getItem(SEEN_KEY) || 0);
    const latestOp = [...thread.messages]
      .reverse()
      .find((m) => m.role === "operator");
    if (!latestOp) {
      setUnseen(0);
      return;
    }
    const at = Date.parse(latestOp.at);
    if (!open && Number.isFinite(at) && at > seenAt) setUnseen(1);
    else setUnseen(0);
  }, [thread, open]);

  useEffect(() => {
    if (!open || !thread) return;
    try {
      localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setUnseen(0);
  }, [open, thread?.updatedAt]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [open, thread?.messages.length, thread?.updatedAt, peerTyping]);

  const messages = useMemo(() => thread?.messages || [], [thread]);

  function startNewConversation() {
    pulseTyping(false);
    setDraft("");
    setAttachments([]);
    setPeerTyping(null);
    try {
      localStorage.removeItem(THREAD_KEY);
    } catch {
      /* ignore */
    }
    applyThread(null);
    toast.success(t("support.chat.ready"));
  }

  async function submitMessage(text?: string) {
    if (!user) {
      toast.error(t("support.chat.signInRequired"));
      return;
    }
    if (thread?.status === "closed") {
      toast.error(t("support.chat.resolvedContinue"));
      return;
    }
    const body = (text ?? draft).trim();
    if (!body && attachments.length === 0) return;
    pulseTyping(false);
    setSending(true);
    try {
      if (!thread) {
        const res = await apiFetch<{ thread: SupportThread }>("/api/support/threads", {
          method: "POST",
          json: {
            subject: t("support.chat.accountSupport"),
            body: body || "(image attached)",
            attachments,
            ...clientHints(),
          },
        });
        applyThread(res.thread);
      } else {
        const res = await apiFetch<{ thread: SupportThread }>(
          `/api/support/threads/${thread.id}`,
          {
            method: "POST",
            json: {
              body: body || "(image attached)",
              attachments,
              ...clientHints(),
            },
          }
        );
        applyThread(res.thread);
      }
      setDraft("");
      setAttachments([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("support.chat.sendFailed");
      toast.error(message);
      if (/resolved|new conversation/i.test(message)) {
        /* keep thread visible; CTA handles next step */
      }
    } finally {
      setSending(false);
    }
  }

  const isResolved = thread?.status === "closed";

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    try {
      const next: SupportAttachment[] = [];
      for (const file of Array.from(files).slice(0, SUPPORT_MAX_ATTACHMENTS)) {
        next.push(await readSupportImageAttachment(file));
      }
      setAttachments((prev) => [...prev, ...next].slice(0, SUPPORT_MAX_ATTACHMENTS));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("support.chat.invalidImage"));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!mounted || !user || user.role === "operator") return null;

  const staffName = thread?.assignedStaffName;
  const presenceLabel =
    PRESENCE_OPTIONS.find((p) => p.id === (user.presenceStatus || "available"))?.label ||
    "Available";

  return createPortal(
    <div className="scw" data-octivate-support>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="panel"
            className="scw-panel"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="scw-head">
              <div className="scw-head-brand">
                <span className="scw-avatar" aria-hidden>
                  <OctivateLogoMark className="scw-logo-mark" decorative />
                </span>
                <div className="scw-head-copy">
                  <p className="scw-head-title">{t("support.chat.title")}</p>
                  <p className="scw-head-status">
                    <span
                      className={cn(
                        "scw-online-dot",
                        isResolved ? "is-resolved" : staffName ? "is-live" : undefined
                      )}
                      aria-hidden
                    />
                    {isResolved
                      ? t("support.chat.resolvedClosed")
                      : staffName
                        ? `Speaking with ${staffName}`
                        : t("support.chat.accountSupportHint")}
                  </p>
                </div>
              </div>
              <div className="scw-head-actions">
                <Tooltip content={t("support.chat.minimize")} side="bottom">
                  <button
                    type="button"
                    className="scw-icon-btn"
                    aria-label={t("support.chat.minimize")}
                    onClick={() => setOpen(false)}
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                </Tooltip>
                <Tooltip content={t("support.chat.close")} side="bottom">
                  <button
                    type="button"
                    className="scw-icon-btn"
                    aria-label={t("support.chat.close")}
                    onClick={() => setOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Tooltip>
              </div>
            </header>

            <div className="scw-account-bar">
              <span className="scw-account-avatar" aria-hidden>
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" />
                ) : (
                  <UserRound className="h-3.5 w-3.5" />
                )}
              </span>
              <span className="scw-account-copy">
                Signed in as <strong>{user.displayName || user.username}</strong>
                <span className="scw-presence"> · {presenceLabel}</span>
              </span>
              {staffName ? (
                <Tooltip content={t("support.chat.assignedStaff")} side="top">
                  <span className="scw-staff-pill">
                    <Shield className="h-3 w-3" aria-hidden />
                    {staffName}
                  </span>
                </Tooltip>
              ) : null}
            </div>

            <div className="scw-messages" ref={scrollRef}>
              {!thread ? (
                <div className="scw-bubble is-system">
                  <p>
                    Welcome. Support is available for signed-in accounts. Choose a topic
                    below or describe your request — a member of the Octivate team will
                    respond.
                  </p>
                </div>
              ) : null}
              {messages.map((m) => (
                <div key={m.id} className={cn("scw-bubble", `is-${m.role}`)}>
                  <span className="scw-bubble-role">
                    {m.role === "operator"
                      ? m.staffName || t("support.chat.title")
                      : m.role === "user"
                        ? "You"
                        : "Octivate"}
                  </span>
                  <p>{m.body}</p>
                  {m.attachments?.length ? (
                    <div className="scw-atts">
                      {m.attachments.map((att) => (
                        <SafeAttachmentThumb
                          key={att.id}
                          attachment={att}
                          onOpen={setPreview}
                        />
                      ))}
                    </div>
                  ) : null}
                  <time>{new Date(m.at).toLocaleString()}</time>
                </div>
              ))}
              {peerTyping ? (
                <div className="scw-bubble is-operator scw-typing" aria-live="polite">
                  <span className="scw-bubble-role">
                    {peerTyping.name || t("support.chat.title")}
                  </span>
                  <p className="scw-typing-dots">
                    <span />
                    <span />
                    <span />
                  </p>
                </div>
              ) : null}
            </div>

            {isResolved ? (
              <div className="scw-resolved" role="status">
                <div className="scw-resolved-copy">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  <div>
                    <p className="scw-resolved-title">{t("support.chat.resolved")}</p>
                    <p className="scw-resolved-text">
                      Messaging is closed on this thread. Start a new conversation if you
                      still need help.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="scw-resolved-cta"
                  onClick={() => startNewConversation()}
                >
                  <MessageSquarePlus className="h-4 w-4" aria-hidden />
                  Start new conversation
                </button>
              </div>
            ) : (
              <>
                {!thread || messages.filter((m) => m.role === "user").length === 0 ? (
                  <div className="scw-quick">
                    {topicPrompts.map((q) => (
                      <Tooltip key={q.id} content={q.text} side="top">
                        <button
                          type="button"
                          className="scw-quick-btn"
                          disabled={sending}
                          onClick={() => void submitMessage(q.text)}
                        >
                          {q.label}
                        </button>
                      </Tooltip>
                    ))}
                  </div>
                ) : null}

                <div className="scw-composer">
                  {attachments.length > 0 ? (
                    <div className="scw-atts is-draft">
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
                  <Tooltip content={t("support.chat.attachHint")} side="top">
                    <button
                      type="button"
                      className="scw-attach"
                      aria-label={t("support.chat.attach")}
                      onClick={() => fileRef.current?.click()}
                      disabled={sending || attachments.length >= SUPPORT_MAX_ATTACHMENTS}
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
                    className="scw-input"
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      if (e.target.value.trim()) pulseTyping(true);
                      else pulseTyping(false);
                    }}
                    placeholder={t("support.chat.placeholder")}
                    rows={3}
                    disabled={sending}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submitMessage();
                      }
                    }}
                  />
                  <Tooltip content={t("support.chat.send")} side="top">
                    <button
                      type="button"
                      className={cn(
                        "scw-send",
                        (draft.trim() || attachments.length > 0) && "is-ready"
                      )}
                      disabled={sending || (!draft.trim() && attachments.length === 0)}
                      onClick={() => void submitMessage()}
                    >
                      <Send className="h-4 w-4" />
                      {t("support.chat.send")}
                    </button>
                  </Tooltip>
                </div>
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Tooltip content={t("support.chat.openAccount")} side="top">
        <button
          type="button"
          className={cn("scw-fab", open && "is-open")}
          aria-label={t("support.chat.open")}
          aria-expanded={open}
          data-tour="support-help"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <X className="h-5 w-5" />
          ) : (
            <>
              <Headphones className="h-5 w-5" />
              <MessageCircle className="scw-fab-badge-icon h-3.5 w-3.5" aria-hidden />
            </>
          )}
          {unseen > 0 && !open ? <span className="scw-fab-dot" aria-hidden /> : null}
        </button>
      </Tooltip>

      <SafeImageLightbox attachment={preview} onClose={() => setPreview(null)} />
    </div>,
    document.body
  );
}

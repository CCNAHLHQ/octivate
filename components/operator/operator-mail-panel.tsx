"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Inbox,
  Mail,
  Send,
  Trash2,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import { apiFetch, getClientApiKey, invalidateApiCache } from "@/lib/api-client";
import { playAlertSound, unlockAlertAudio } from "@/lib/alerts/sounds";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import type { PublicUser } from "@/lib/auth/types";
import type { MailingSubscriber } from "@/lib/types";
import { cn } from "@/lib/utils";

type MailMessage = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  at: string;
  direction: "inbound" | "outbound";
};

type SendResult = {
  message: string;
  recipients: number;
  delivered: "smtp" | "local";
  warnings?: string[];
  errors?: string[];
  response?: string;
  templateName?: string;
  ok?: boolean;
};

function MailCheck({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={cn("op-mail-check", checked && "is-checked", className)}
      onClick={() => onChange(!checked)}
    >
      <span className="op-mail-check-box" aria-hidden>
        {checked ? <Check className="h-3 w-3" /> : null}
      </span>
      {label ? <span className="op-mail-check-label">{label}</span> : null}
    </button>
  );
}

type ClearConfirm =
  | { mode: "one"; id: string; subject: string }
  | { mode: "all"; count: number };

function SendStatusBadge({ result }: { result: SendResult }) {
  const failed = Boolean(result.errors?.length) || result.ok === false;
  return (
    <span
      className={cn("op-mail-status-badge", failed ? "is-fail" : "is-sent")}
      role="status"
      aria-live="polite"
    >
      {failed ? (
        <XCircle className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
      )}
      {failed ? "Failed" : "Sent"}
    </span>
  );
}

function MailingListDropzone({ onImported }: { onImported: () => void | Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const upload = useCallback(
    async (list: File[]) => {
      const files = list.filter((f) =>
        /\.(csv|tsv|txt|text|json)$/i.test(f.name)
      );
      if (!files.length) {
        toast.error("Use CSV, TSV, TXT, or JSON");
        return;
      }
      setBusy(true);
      try {
        const body = new FormData();
        for (const file of files) body.append("files", file, file.name);
        const res = await apiFetch<{
          added: number;
          updated: number;
          total: number;
          message?: string;
        }>("/api/operator/mail/import", {
          method: "POST",
          body,
          headers: { Authorization: `Bearer ${getClientApiKey()}` },
          skipCache: true,
        });
        invalidateApiCache("/api/operator/mail");
        toast.success(
          res.message ||
            `Added ${res.added} · updated ${res.updated} · ${res.total} active`
        );
        await onImported();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed");
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onImported]
  );

  return (
    <div
      className={cn(
        "op-mail-dropzone",
        dragging && "is-dragging",
        busy && "is-busy"
      )}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void upload(Array.from(e.dataTransfer.files || []));
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,.text,.json,text/csv,text/plain,application/json"
        multiple
        className="op-mail-dropzone-input"
        disabled={busy}
        onChange={(e) => void upload(Array.from(e.target.files || []))}
      />
      <Upload className="h-4 w-4" aria-hidden />
      <div className="op-mail-dropzone-copy">
        <strong>{busy ? "Importing…" : "Drop list to add"}</strong>
        <span>CSV · TSV · TXT · JSON</span>
      </div>
      <button
        type="button"
        className="op-mail-btn is-ghost"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        Upload
      </button>
    </div>
  );
}

export function OperatorMailPanel() {
  const [mailbox, setMailbox] = useState("");
  const [fromOptions, setFromOptions] = useState<string[]>([]);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [mailing, setMailing] = useState<MailingSubscriber[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [useDefaultTemplate, setUseDefaultTemplate] = useState(true);
  const [templateName, setTemplateName] = useState("Octivate");
  const [lastResult, setLastResult] = useState<SendResult | null>(null);
  const [mailPage, setMailPage] = useState(0);
  const [clearConfirm, setClearConfirm] = useState<ClearConfirm | null>(null);
  const [clearBusy, setClearBusy] = useState(false);
  const fromInitRef = useRef(false);
  const MAIL_PAGE_SIZE = 8;

  const load = useCallback(async () => {
    const mail = await apiFetch<{
      mailbox: string;
      messages: MailMessage[];
      fromOptions: string[];
      preferredFrom?: string;
      mailing?: MailingSubscriber[];
      defaultTemplate?: { id: string; name: string };
    }>("/api/operator/mail", { skipCache: true });

    setMailbox(mail.mailbox);
    setMessages(mail.messages || []);
    const options = mail.fromOptions?.length
      ? mail.fromOptions
      : [mail.preferredFrom || "no-reply@octivate.io"];
    setFromOptions(options);
    setFrom((prev) => {
      if (!fromInitRef.current || !prev) {
        fromInitRef.current = true;
        return mail.preferredFrom || options[0] || "no-reply@octivate.io";
      }
      return options.includes(prev) ? prev : mail.preferredFrom || options[0];
    });
    if (mail.defaultTemplate?.name) setTemplateName(mail.defaultTemplate.name);
    const list = (mail.mailing || []).filter((m) => m.status !== "unsubscribed");
    setMailing(list);
  }, []);

  useEffect(() => {
    void load().catch((err) => toast.error(err instanceof Error ? err.message : "Mail load failed"));
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load().catch(() => {});
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const mailPageCount = Math.max(1, Math.ceil(mailing.length / MAIL_PAGE_SIZE));
  const safeMailPage = Math.min(mailPage, mailPageCount - 1);
  const mailingPage = mailing.slice(
    safeMailPage * MAIL_PAGE_SIZE,
    safeMailPage * MAIL_PAGE_SIZE + MAIL_PAGE_SIZE
  );

  useEffect(() => {
    if (mailPage > mailPageCount - 1) setMailPage(Math.max(0, mailPageCount - 1));
  }, [mailPage, mailPageCount]);

  const selectedOnPage = useMemo(
    () => mailingPage.filter((m) => selected.includes(m.email)).length,
    [mailingPage, selected]
  );

  async function send(bulk: boolean) {
    if (busy) return;
    setBusy(true);
    setLastResult(null);
    void unlockAlertAudio();
    try {
      const res = await apiFetch<SendResult>("/api/operator/mail", {
        method: "POST",
        json: {
          action: bulk ? "bulk" : "send",
          from,
          to: bulk ? selected : selected.slice(0, 1),
          subject,
          text,
          useDefaultTemplate,
          selectAllMailing: bulk && selectAll,
        },
      });
      const failed = Boolean(res.errors?.length) || res.ok === false;
      setLastResult({
        ...res,
        message: failed ? "Failed" : "Sent",
        ok: !failed,
      });
      if (failed) {
        toast.error("Failed");
      } else {
        void playAlertSound("success");
        toast.success("Sent");
        setSubject("");
        setText("");
      }
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed";
      setLastResult({
        message: "Failed",
        recipients: 0,
        delivered: "local",
        errors: [message],
        ok: false,
      });
      toast.error("Failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleRecipient(email: string) {
    setSelectAll(false);
    setSelected((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  }

  function applyClearResult(res: {
    ok?: boolean;
    message?: string;
    messages?: MailMessage[];
    warnings?: string[];
    errors?: string[];
  }) {
    if (Array.isArray(res.messages)) setMessages(res.messages);
    if (res.errors?.length) {
      toast.error([res.message, ...res.errors].filter(Boolean));
      return;
    }
    if (res.warnings?.length) {
      toast.warning([res.message, ...res.warnings].filter(Boolean));
      return;
    }
    if (res.ok === false) {
      toast.error(res.message || "Clear failed");
      return;
    }
    toast.success(res.message || "Inbox updated");
  }

  async function runClear() {
    if (!clearConfirm || !mailbox || clearBusy) return;
    setClearBusy(true);
    try {
      const res = await apiFetch<{
        ok?: boolean;
        message?: string;
        messages?: MailMessage[];
        warnings?: string[];
        errors?: string[];
      }>("/api/operator/mail", {
        method: "DELETE",
        json:
          clearConfirm.mode === "all"
            ? { mailbox, clearAll: true }
            : { mailbox, id: clearConfirm.id },
      });
      applyClearResult(res);
      setClearConfirm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setClearBusy(false);
    }
  }

  const canSend = Boolean(from && subject && text && selected.length);

  return (
    <div className="op-mail">
      <section className="op-mail-pane op-mail-compose">
        <header className="op-mail-pane-head">
          <div className="op-mail-pane-title">
            <Mail className="h-4 w-4 text-tide" aria-hidden />
            <div>
              <h3>Compose</h3>
              <p>Send from staff or no-reply · template optional</p>
            </div>
          </div>
          {lastResult ? <SendStatusBadge result={lastResult} /> : null}
        </header>

        <div className="op-mail-compose-body">
          <label className="op-mail-field">
            <span>From</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              {fromOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                  {opt === fromOptions[0] ? " · signed-in default" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="op-mail-field">
            <span>Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject line"
            />
          </label>

          <label className="op-mail-field is-grow">
            <span>Body</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Plain text — wrapped in the HTML template when enabled"
              rows={7}
            />
          </label>

          <div className="op-mail-toggles">
            <MailCheck
              checked={useDefaultTemplate}
              onChange={setUseDefaultTemplate}
              label={`Use ${templateName} template`}
            />
          </div>
        </div>

        <footer className="op-mail-actions">
          <Tooltip
            content={
              canSend
                ? "Send to the first selected recipient"
                : "Choose recipients, subject, and body first"
            }
            side="top"
            wrap={false}
          >
            <button
              type="button"
              className={cn("op-mail-btn is-primary", canSend && !busy && "is-ready")}
              disabled={busy || !canSend}
              onClick={() => void send(false)}
            >
              <Send className="h-4 w-4" />
              {busy ? "Sending…" : "Send"}
            </button>
          </Tooltip>
          <Tooltip
            content={
              canSend
                ? `Bulk send to ${selected.length} selected recipient${selected.length === 1 ? "" : "s"}`
                : "Select one or more mailing-list recipients"
            }
            side="top"
            wrap={false}
          >
            <button
              type="button"
              className="op-mail-btn"
              disabled={busy || !canSend}
              onClick={() => void send(true)}
            >
              <Users className="h-4 w-4" />
              Bulk send
            </button>
          </Tooltip>
        </footer>
      </section>

      <div className="op-mail-rail">
        <section className="op-mail-pane op-mail-subscribers">
          <header className="op-mail-pane-head">
            <div className="op-mail-pane-title">
              <Users className="h-4 w-4 text-violet" aria-hidden />
              <div>
                <h3>Mailing list</h3>
                <p>
                  {selected.length}/{mailing.length} selected
                  {mailingPage.length ? ` · ${selectedOnPage} on page` : ""}
                </p>
              </div>
            </div>
            <MailCheck
              checked={selectAll && mailing.length > 0}
              onChange={(next) => {
                setSelectAll(next);
                setSelected(next ? mailing.map((m) => m.email) : []);
              }}
              label="All"
            />
          </header>

          <MailingListDropzone onImported={load} />

          <div className="op-mail-sub-list">
            {mailingPage.map((m) => {
              const on = selected.includes(m.email);
              return (
                <button
                  key={m.id}
                  type="button"
                  className={cn("op-mail-sub-row", on && "is-selected")}
                  onClick={() => toggleRecipient(m.email)}
                >
                  <span className={cn("op-mail-check-box", on && "is-on")} aria-hidden>
                    {on ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span className="op-mail-sub-copy">
                    <span className="op-mail-sub-email">{m.email}</span>
                    {m.name ? <span className="op-mail-sub-name">{m.name}</span> : null}
                  </span>
                </button>
              );
            })}
            {!mailing.length ? (
              <p className="op-mail-empty">
                No subscribers yet — upload a list or wait for landing-page signups.
              </p>
            ) : null}
          </div>

          {mailing.length > MAIL_PAGE_SIZE ? (
            <div className="op-mail-pager">
              <span>
                {safeMailPage * MAIL_PAGE_SIZE + 1}–
                {Math.min((safeMailPage + 1) * MAIL_PAGE_SIZE, mailing.length)} of {mailing.length}
              </span>
              <div className="op-mail-pager-controls">
                <button
                  type="button"
                  className="op-mail-btn is-ghost"
                  disabled={safeMailPage <= 0}
                  onClick={() => setMailPage((p) => Math.max(0, p - 1))}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="op-mail-btn is-ghost"
                  disabled={safeMailPage >= mailPageCount - 1}
                  onClick={() => setMailPage((p) => Math.min(mailPageCount - 1, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="op-mail-pane op-mail-inbox">
          <header className="op-mail-pane-head">
            <div className="op-mail-pane-title">
              <Inbox className="h-4 w-4 text-tide" aria-hidden />
              <div>
                <h3>Inbox</h3>
                <p>{mailbox || "—"}</p>
              </div>
            </div>
            <div className="op-mail-inbox-tools">
              <span className="op-mail-count">{messages.length}</span>
              <Tooltip content="Clear every message in this mailbox" side="top" wrap={false}>
                <button
                  type="button"
                  className="op-mail-btn is-ghost is-danger-ghost"
                  disabled={!messages.length || clearBusy}
                  onClick={() =>
                    setClearConfirm({ mode: "all", count: messages.length })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear all
                </button>
              </Tooltip>
            </div>
          </header>
          <div className="op-mail-inbox-list">
            {messages.map((m) => (
              <article key={m.id} className="op-mail-msg">
                <div className="op-mail-msg-top">
                  <p className="op-mail-msg-subject">{m.subject}</p>
                  <div className="op-mail-msg-tools">
                    <span className={cn("op-mail-msg-dir", `is-${m.direction}`)}>
                      {m.direction}
                    </span>
                    <Tooltip content="Clear this message" side="top" wrap={false}>
                      <button
                        type="button"
                        className="op-mail-icon-clear"
                        aria-label={`Clear ${m.subject || "message"}`}
                        disabled={clearBusy}
                        onClick={() =>
                          setClearConfirm({
                            mode: "one",
                            id: m.id,
                            subject: m.subject || "(no subject)",
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
                <p className="op-mail-msg-meta">
                  {m.from} → {m.to.join(", ")} · {new Date(m.at).toLocaleString()}
                </p>
                <p className="op-mail-msg-body">{m.text.slice(0, 280)}</p>
              </article>
            ))}
            {!messages.length ? (
              <p className="op-mail-empty">No messages in this mailbox yet.</p>
            ) : null}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(clearConfirm)}
        busy={clearBusy}
        busyLabel="Clearing…"
        title={
          clearConfirm?.mode === "all"
            ? "Clear entire inbox?"
            : "Clear this message?"
        }
        description={
          clearConfirm?.mode === "all"
            ? `This removes ${clearConfirm.count} message${clearConfirm.count === 1 ? "" : "s"} from the current mailbox. This cannot be undone.`
            : `“${clearConfirm?.subject || "Untitled"}” will be removed from this mailbox. This cannot be undone.`
        }
        confirmLabel={clearConfirm?.mode === "all" ? "Clear all" : "Clear message"}
        onCancel={() => {
          if (!clearBusy) setClearConfirm(null);
        }}
        onConfirm={() => void runClear()}
      />
    </div>
  );
}

const USERS_PAGE_SIZE = 8;

export function OperatorUsersPanel() {
  const [stats, setStats] = useState<{
    total: number;
    registered: number;
    operators: number;
    members: number;
    disabled: number;
    mailingActive: number;
  } | null>(null);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const res = await apiFetch<{
      stats: {
        total?: number;
        registered: number;
        operators: number;
        members: number;
        disabled: number;
        mailingActive: number;
      };
      users: PublicUser[];
    }>("/api/operator/users", { skipCache: true });
    const nextUsers = res.users || [];
    const members = res.stats.members ?? 0;
    const operators = res.stats.operators ?? 0;
    const disabled = res.stats.disabled ?? 0;
    setStats({
      total: res.stats.total ?? nextUsers.length,
      registered: res.stats.registered ?? members + operators,
      operators,
      members,
      disabled,
      mailingActive: res.stats.mailingActive ?? 0,
    });
    setUsers(nextUsers);
  }, []);

  useEffect(() => {
    void load().catch(() => toast.error("Could not load users"));
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = [
        u.displayName,
        u.username,
        u.email,
        u.role,
        u.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [users, query]);

  useEffect(() => {
    setPage(0);
  }, [query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / USERS_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(
    safePage * USERS_PAGE_SIZE,
    safePage * USERS_PAGE_SIZE + USERS_PAGE_SIZE
  );

  async function act(id: string, action: "disable" | "enable" | "reset-password") {
    setBusyId(id);
    try {
      const res = await apiFetch<{ password?: string; message?: string }>(
        "/api/operator/users",
        { method: "PATCH", json: { id, action } }
      );
      if (res.password) {
        await navigator.clipboard.writeText(res.password);
        setCopied(id);
        toast.success("New password copied to clipboard");
      } else {
        toast.success(res.message || "Updated");
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  const totalAccounts =
    stats?.total ??
    (stats ? stats.members + stats.operators + stats.disabled : 0);

  const segments = [
    { name: "Members", value: stats?.members || 0 },
    { name: "Operators", value: stats?.operators || 0 },
    { name: "Disabled", value: stats?.disabled || 0 },
  ];

  return (
    <div className="op-users-panel">
      <div className="op-users-kpis">
        <div className="card p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-faint">Active</p>
          <p className="mt-1 text-2xl font-semibold text-foam">{stats?.registered ?? "—"}</p>
        </div>
        <div className="card p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-faint">Members</p>
          <p className="mt-1 text-2xl font-semibold text-foam">{stats?.members ?? "—"}</p>
        </div>
        <div className="card p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-faint">Operators</p>
          <p className="mt-1 text-2xl font-semibold text-foam">{stats?.operators ?? "—"}</p>
        </div>
        <div className="card p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-faint">Disabled</p>
          <p className="mt-1 text-2xl font-semibold text-foam">{stats?.disabled ?? "—"}</p>
        </div>
        <div className="card p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-faint">Mailing list</p>
          <p className="mt-1 text-2xl font-semibold text-foam">{stats?.mailingActive ?? "—"}</p>
        </div>
      </div>

      <div className="card p-4">
        <p className="mb-2 text-sm font-semibold text-foam">Account mix</p>
        <div className="flex flex-wrap gap-3">
          {segments.map((s) => (
            <div
              key={s.name}
              className="min-w-[120px] flex-1 rounded-[12px] border border-[var(--line)] px-3 py-3"
            >
              <p className="font-mono text-[10px] uppercase text-faint">{s.name}</p>
              <p className="text-xl font-semibold text-foam">{s.value}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--pill-bg)]">
                <div
                  className="h-full rounded-full bg-[var(--violet)]"
                  style={{
                    width: `${Math.min(
                      100,
                      totalAccounts > 0 ? (s.value / totalAccounts) * 100 : 0
                    )}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card op-users-table-card">
        <div className="op-users-table-toolbar">
          <label className="op-users-search">
            <Users className="h-3.5 w-3.5 text-faint" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users…"
              aria-label="Search users"
            />
          </label>
          <p className="op-users-table-meta">
            {filtered.length
              ? `${safePage * USERS_PAGE_SIZE + 1}–${Math.min(
                  (safePage + 1) * USERS_PAGE_SIZE,
                  filtered.length
                )} of ${filtered.length}`
              : "0 users"}
          </p>
        </div>

        <div className="op-users-table-scroll">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--line)] text-[11px] uppercase tracking-wider text-faint">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((u) => (
                <tr key={u.id} className="border-b border-[var(--line)]">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      {u.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.avatarUrl}
                          alt=""
                          className="mt-0.5 h-8 w-8 rounded-full border border-[var(--line)] object-cover"
                        />
                      ) : (
                        <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--pill-bg)] text-[10px] font-bold text-foam">
                          {(u.displayName || u.username || "?").slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-foam">
                          {u.displayName}
                          {u.disabled ? (
                            <span className="ml-2 font-mono text-[10px] uppercase text-amber">
                              Disabled
                            </span>
                          ) : null}
                        </p>
                        <p className="font-mono text-[11px] text-faint">
                          {u.email} · {u.username}
                        </p>
                        {u.description ? (
                          <p className="mt-1 line-clamp-2 text-[11px] text-mist">
                            {u.description.replace(/\[[^\]]+\]/g, "").slice(0, 140)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-mist">{u.role}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-faint">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {u.role === "operator" && u.staffProfileId ? (
                      <span className="text-xs text-faint">Protected founder</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === u.id}
                          onClick={() =>
                            void act(u.id, u.disabled ? "enable" : "disable")
                          }
                        >
                          {u.disabled ? "Enable" : "Disable"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busyId === u.id}
                          onClick={() => void act(u.id, "reset-password")}
                        >
                          {copied === u.id ? (
                            <>
                              <Check className="h-3.5 w-3.5" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" /> Reset password
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!pageRows.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-faint">
                    {query.trim() ? "No users match this search." : "No users yet."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {filtered.length > USERS_PAGE_SIZE ? (
          <div className="op-users-pager">
            <span>
              Page {safePage + 1}/{pageCount}
            </span>
            <div className="op-users-pager-controls">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={safePage <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
